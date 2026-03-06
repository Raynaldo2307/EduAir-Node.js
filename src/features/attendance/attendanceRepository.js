const pool = require('../../../config/db');

// Columns returned on every SELECT — change once, updates everywhere
const ATTENDANCE_FIELDS = `
  a.id,
  a.school_id,
  a.student_id,
  a.class_id,
  a.shift_type,
  a.attendance_date,
  a.clock_in,
  a.clock_in_lat,
  a.clock_in_lng,
  a.clock_out,
  a.clock_out_lat,
  a.clock_out_lng,
  a.status,
  a.is_early_leave,
  a.source,
  a.late_reason_code,
  a.device_id,
  a.note,
  a.recorded_by_user_id,
  a.created_at,
  a.updated_at,
  u.first_name  AS student_first_name,
  u.last_name   AS student_last_name
`;

// Fetch a single attendance record after insert/update
async function getRecord(id, schoolId) {
  const [rows] = await pool.query(
    `SELECT ${ATTENDANCE_FIELDS}
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     JOIN users u    ON s.user_id    = u.id
     WHERE a.id = ? AND a.school_id = ?
     LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] ?? null;
}

// Look up a student record by the logged-in user's id
async function getStudentByUserId(userId, schoolId) {
  const [rows] = await pool.query(
    `SELECT id, homeroom_class_id, current_shift_type, status
     FROM students
     WHERE user_id = ? AND school_id = ?
     LIMIT 1`,
    [userId, schoolId]
  );
  return rows[0] ?? null;
}

// Look up a student record by students.id — used for teacher/admin marking
// Includes user_id for ownership checks (e.g. student history access)
async function getStudentById(studentId, schoolId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, homeroom_class_id, current_shift_type, status
     FROM students
     WHERE id = ? AND school_id = ?
     LIMIT 1`,
    [studentId, schoolId]
  );
  return rows[0] ?? null;
}

// INSERT attendance row — accepts conn for transaction support
async function insertClockIn(data, conn) {
  const {
    schoolId, studentId, classId, userId,
    shift_type, clock_in_lat, clock_in_lng,
    status, source, late_reason_code, device_id, note,
  } = data;

  const [result] = await conn.query(
    `INSERT INTO attendance
       (school_id, student_id, class_id, recorded_by_user_id,
        shift_type, attendance_date,
        clock_in, clock_in_lat, clock_in_lng,
        status, source, late_reason_code, device_id, note)
     VALUES
       (?, ?, ?, ?,
        ?, CURDATE(),
        NOW(), ?, ?,
        ?, ?, ?, ?, ?)`,
    [
      schoolId,
      studentId,
      classId         ?? null,
      userId,
      shift_type,
      clock_in_lat    ?? null,
      clock_in_lng    ?? null,
      status,
      source,
      late_reason_code ?? null,
      device_id        ?? null,
      note             ?? null,
    ]
  );
  return result.insertId;
}

// Append an audit row to attendance_history — accepts conn for transaction support
async function writeHistory(data, conn) {
  const { attendanceId, previousStatus, newStatus, changedByUserId, source } = data;
  await conn.query(
    `INSERT INTO attendance_history
       (attendance_id, previous_status, new_status, changed_by_user_id, source)
     VALUES (?, ?, ?, ?, ?)`,
    [attendanceId, previousStatus ?? null, newStatus, changedByUserId, source]
  );
}

// Fetch attendance records for a school on a given date with optional filters
async function getAttendanceBySchool(schoolId, date, filters) {
  const { shift_type, class_id } = filters;

  let query = `
    SELECT
      a.id,
      a.student_id,
      a.shift_type,
      a.attendance_date,
      a.clock_in,
      a.clock_out,
      a.status,
      a.is_early_leave,
      a.source,
      a.late_reason_code,
      a.note,
      u.first_name  AS student_first_name,
      u.last_name   AS student_last_name,
      c.name        AS class_name,
      c.grade_level
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN users u    ON s.user_id    = u.id
    LEFT JOIN classes c ON a.class_id = c.id
    WHERE a.school_id      = ?
      AND a.attendance_date = ?
  `;

  const params = [schoolId, date];

  if (shift_type) {
    query += ' AND a.shift_type = ?';
    params.push(shift_type);
  }

  if (class_id) {
    query += ' AND a.class_id = ?';
    params.push(class_id);
  }

  query += ' ORDER BY u.last_name ASC, u.first_name ASC';

  const [rows] = await pool.query(query, params);
  return rows;
}

// Fetch a student's attendance history with optional shift filter + limit
async function getStudentHistory(studentId, schoolId, filters) {
  const { shift_type, limit } = filters;

  let query = `
    SELECT
      a.id,
      a.shift_type,
      a.attendance_date,
      a.clock_in,
      a.clock_out,
      a.status,
      a.is_early_leave,
      a.late_reason_code,
      a.note,
      a.source,
      a.created_at
    FROM attendance a
    WHERE a.student_id = ? AND a.school_id = ?
  `;

  const params = [studentId, schoolId];

  if (shift_type) {
    query += ' AND a.shift_type = ?';
    params.push(shift_type);
  }

  query += ' ORDER BY a.attendance_date DESC LIMIT ?';
  params.push(limit);

  const [rows] = await pool.query(query, params);
  return rows;
}

// Fetch record for clock-out — join students so we can check user_id for student role.
//
// ADD (Claude — Mar 1 2026):
//   Added shift_type to the SELECT so the service can compute is_early_leave
//   by comparing clock-out time against the correct shift end boundary.
async function getRecordForClockOut(id, schoolId, conn) {
  const [rows] = await conn.query(
    `SELECT a.id, a.clock_in, a.clock_out, a.status, a.source, a.shift_type, s.user_id
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     WHERE a.id = ? AND a.school_id = ?
     LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] ?? null;
}

// UPDATE clock-out fields — accepts conn for transaction support.
//
// FIX (Claude — Mar 1 2026):
//   Added is_early_leave to the UPDATE so it is persisted to the DB.
//   Previously the column existed in the schema but was always NULL
//   because nothing was ever writing to it.
//   The value is computed in attendanceService.clockOut() and passed in here.
async function updateClockOut(id, schoolId, data, conn) {
  const { clock_out_lat, clock_out_lng, isEarlyLeave } = data;
  await conn.query(
    `UPDATE attendance
     SET clock_out      = NOW(),
         clock_out_lat  = COALESCE(?, clock_out_lat),
         clock_out_lng  = COALESCE(?, clock_out_lng),
         is_early_leave = ?
     WHERE id = ? AND school_id = ?`,
    [clock_out_lat ?? null, clock_out_lng ?? null, isEarlyLeave ? 1 : 0, id, schoolId]
  );
}

// Fetch record for status update — accepts conn for transaction support
async function getRecordForUpdate(id, schoolId, conn) {
  const [rows] = await conn.query(
    `SELECT id, status FROM attendance WHERE id = ? AND school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] ?? null;
}

// UPDATE attendance status/note — accepts conn for transaction support
async function updateStatus(id, schoolId, data, conn) {
  const { status, late_reason_code, note, userId } = data;
  await conn.query(
    `UPDATE attendance
     SET status              = COALESCE(?, status),
         late_reason_code    = COALESCE(?, late_reason_code),
         note                = COALESCE(?, note),
         recorded_by_user_id = ?
     WHERE id = ? AND school_id = ?`,
    [
      status           ?? null,
      late_reason_code ?? null,
      note             ?? null,
      userId,
      id,
      schoolId,
    ]
  );
}

// Fetch today's record — used before delete to enforce today-only rule
async function findTodayRecord(id, schoolId) {
  const [rows] = await pool.query(
    `SELECT id, attendance_date
     FROM attendance
     WHERE id = ? AND school_id = ? AND attendance_date = CURDATE()
     LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] ?? null;
}

async function deleteHistoryByAttendance(id) {
  await pool.query('DELETE FROM attendance_history WHERE attendance_id = ?', [id]);
}

async function deleteRecord(id, schoolId) {
  await pool.query('DELETE FROM attendance WHERE id = ? AND school_id = ?', [id, schoolId]);
}

module.exports = {
  getRecord,
  getStudentByUserId,
  getStudentById,
  insertClockIn,
  writeHistory,
  getAttendanceBySchool,
  getStudentHistory,
  getRecordForClockOut,
  updateClockOut,
  getRecordForUpdate,
  updateStatus,
  findTodayRecord,
  deleteHistoryByAttendance,
  deleteRecord,
};
