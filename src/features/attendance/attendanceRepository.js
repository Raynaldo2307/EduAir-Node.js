const pool = require('../../../config/db');

// Columns returned on every SELECT — change once, updates everywhere
// attendance_date → 'YYYY-MM-DD' string (Flutter dateKey format)
// clock_in/out    → 'YYYY-MM-DDTHH:MM:SS' string (Dart DateTime.parse compatible)
const ATTENDANCE_FIELDS = `
  a.id,
  a.school_id,
  a.student_id,
  a.class_id,
  a.shift_type,
  DATE_FORMAT(a.attendance_date, '%Y-%m-%d')                                          AS attendance_date,
  IF(a.clock_in  IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_in),  NULL) AS clock_in,
  a.clock_in_lat,
  a.clock_in_lng,
  IF(a.clock_out IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_out), NULL) AS clock_out,
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
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      IF(a.clock_in  IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_in),  NULL) AS clock_in,
      IF(a.clock_out IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_out), NULL) AS clock_out,
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
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      IF(a.clock_in  IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_in),  NULL) AS clock_in,
      IF(a.clock_out IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_out), NULL) AS clock_out,
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

// Fetch today's single record for a student — used by GET /api/attendance/today
async function getTodayRecord(studentId, schoolId, shiftType) {
  let query = `
    SELECT
      a.id,
      a.shift_type,
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      IF(a.clock_in  IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_in),  NULL) AS clock_in,
      IF(a.clock_out IS NOT NULL, CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_out), NULL) AS clock_out,
      a.status,
      a.is_early_leave,
      a.late_reason_code,
      a.note,
      a.source,
      a.created_at
    FROM attendance a
    WHERE a.student_id = ? AND a.school_id = ? AND a.attendance_date = CURDATE()
  `;
  const params = [studentId, schoolId];

  if (shiftType) {
    query += ' AND a.shift_type = ?';
    params.push(shiftType);
  }

  query += ' ORDER BY a.created_at DESC LIMIT 1';

  const [rows] = await pool.query(query, params);
  return rows[0] ?? null;
}

// Find a specific record for batch upsert — accepts conn for transaction support
async function findRecordForDate(studentId, schoolId, date, shiftType, conn) {
  const [rows] = await conn.query(
    `SELECT id, status
     FROM attendance
     WHERE student_id = ? AND school_id = ? AND attendance_date = ? AND shift_type = ?
     LIMIT 1`,
    [studentId, schoolId, date, shiftType]
  );
  return rows[0] ?? null;
}

// INSERT a teacher batch record with an explicit date (no clock_in time)
async function insertBatchRecord(data, conn) {
  const {
    schoolId, studentId, classId, userId,
    shift_type, date, status, source, late_reason_code, note,
  } = data;

  const [result] = await conn.query(
    `INSERT INTO attendance
       (school_id, student_id, class_id, recorded_by_user_id,
        shift_type, attendance_date,
        status, source, late_reason_code, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      schoolId,
      studentId,
      classId          ?? null,
      userId,
      shift_type,
      date,
      status,
      source,
      late_reason_code ?? null,
      note             ?? null,
    ]
  );
  return result.insertId;
}

// ─────────────────────────────────────────────────────────────────────────────
// getStudentsByClassForToday(classId, schoolId, shiftType)
// Returns ALL students in a class, each with their attendance record for today
// (if one exists). Students with no attendance yet show status = null.
//
// WHY this query design:
//   The teacher opens the attendance page and sees their whole class.
//   Students already marked show their status (present/late/absent).
//   Unmarked students show up too — teacher can mark them.
//   This gives the teacher a FULL picture, not just who has been marked.
//
// WHY LEFT JOIN on attendance:
//   INNER JOIN would hide students with no attendance record yet.
//   LEFT JOIN keeps every student in the result, with NULL attendance fields
//   if they haven't been marked today.
// ─────────────────────────────────────────────────────────────────────────────
async function getStudentsByClassForToday(classId, schoolId, shiftType) {
  // Build the base query — we always filter by classId, schoolId, and today's date
  let query = `
    SELECT
      s.id                  AS student_id,
      u.first_name,
      u.last_name,
      s.student_code,       -- e.g. PAP-2026-0001 (the student's ID number)
      s.sex,
      s.current_shift_type, -- The student's assigned shift (may differ from the class default)

      -- Attendance fields — these will be NULL if the student hasn't been marked today
      a.id                  AS attendance_id,
      a.status,             -- present / late / absent / excused / null (not yet marked)
      a.shift_type,
      IF(a.clock_in IS NOT NULL,
         CONCAT(DATE_FORMAT(a.attendance_date, '%Y-%m-%d'), 'T', a.clock_in),
         NULL)              AS clock_in,
      a.late_reason_code,
      a.note

    FROM students s
    JOIN users u
      ON s.user_id = u.id           -- Every student must have a linked user account

    LEFT JOIN attendance a
      ON a.student_id    = s.id
      AND a.school_id    = ?         -- Only look at THIS school's attendance records
      AND a.attendance_date = CURDATE() -- Only today's records
      ${shiftType ? 'AND a.shift_type = ?' : ''}
      -- If a shift filter is given, only show that shift's attendance record

    WHERE s.homeroom_class_id = ?    -- Only students whose homeroom is this class
      AND s.school_id         = ?    -- Multi-tenant safety — only this school's students
      AND s.status            = 'active'
      -- Exclude graduated or inactive students from the attendance list

    ORDER BY u.last_name ASC, u.first_name ASC
    -- Alphabetical order — standard for a class register
  `;

  // Build the params array in the same order as the ? placeholders
  const params = [schoolId];           // First ? = school_id in the LEFT JOIN
  if (shiftType) params.push(shiftType); // Second ? = shift_type (only if filter given)
  params.push(classId, schoolId);      // Last two ? = homeroom_class_id and s.school_id

  const [rows] = await pool.query(query, params);
  return rows;
}

 async function getStatsByDate(schoolId, date) {
    const [rows] = await pool.query(                                                                                                                                 `SELECT                                                                                                                                                   
         COUNT(CASE WHEN status IN ('present', 'early') THEN 1 END) AS present,
         COUNT(CASE WHEN status = 'late'    THEN 1 END)             AS late,                                                                                    
         COUNT(CASE WHEN status = 'absent'  THEN 1 END)             AS absent,                                                                                  
         COUNT(CASE WHEN status = 'excused' THEN 1 END)             AS excused,
         COUNT(*)                                                    AS total_marked                                                                            
       FROM attendance
       WHERE school_id = ? AND attendance_date = ?`,                                                                                                            
      [schoolId, date]
    );
    return rows[0];
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
  getTodayRecord,
  findRecordForDate,
  insertBatchRecord,
  getStudentsByClassForToday,
  getStatsByDate,
};
