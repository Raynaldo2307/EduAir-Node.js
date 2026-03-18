const pool = require('../../../config/db');

// Fetch full student record by student id + school id.
// Used after INSERT and UPDATE to return clean, consistent data.
// LEFT JOIN classes so students without a class still appear.
async function getStudentById(studentId, schoolId) {
  const [rows] = await pool.query(
    `SELECT
       s.id               AS student_id,
       u.id               AS user_id,
       u.email,
       u.first_name,
       u.last_name,
       s.student_code,
       s.sex,
       s.date_of_birth,
       s.current_shift_type,
       s.phone_number,
       s.status,
       s.homeroom_class_id,
       c.name             AS class_name,
       c.grade_level
     FROM students s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN classes c ON s.homeroom_class_id = c.id
     WHERE s.id = ? AND s.school_id = ?
     LIMIT 1`,
    [studentId, schoolId]
  );
  return rows[0] ?? null;
}

// Lightweight check — returns { id, user_id } for ownership verification before update/delete.
async function findStudent(id, schoolId) {
  const [rows] = await pool.query(
    'SELECT id, user_id FROM students WHERE id = ? AND school_id = ? LIMIT 1',
    [id, schoolId]
  );
  return rows[0] ?? null;
}

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] ?? null;
}

async function insertUser(data) {
  const { email, passwordHash, first_name, last_name, schoolId } = data;
  const [result] = await pool.query(
    `INSERT INTO users
       (email, password_hash, first_name, last_name, role, school_id)
     VALUES (?, ?, ?, ?, 'student', ?)`,
    [email, passwordHash, first_name, last_name, schoolId]
  );
  return result.insertId;
}

async function insertStudent(data) {
  const {
    schoolId, userId, first_name, last_name,
    student_code, sex, date_of_birth,
    current_shift_type, phone_number, homeroom_class_id,
  } = data;
  const [result] = await pool.query(
    `INSERT INTO students
       (school_id, user_id, first_name, last_name,
        student_code, sex, date_of_birth,
        current_shift_type, phone_number, homeroom_class_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      schoolId,
      userId,
      first_name,
      last_name,
      student_code       ?? null,
      sex                ?? null,
      date_of_birth      ?? null,
      current_shift_type ?? 'whole_day',
      phone_number       ?? null,
      homeroom_class_id  ?? null,
    ]
  );
  return result.insertId;
}

async function updateUser(userId, data) {
  const { first_name, last_name } = data;
  await pool.query(
    `UPDATE users
     SET
       first_name = COALESCE(?, first_name),
       last_name  = COALESCE(?, last_name)
     WHERE id = ?`,
    [first_name ?? null, last_name ?? null, userId]
  );
}

async function updateStudent(id, schoolId, data) {
  const {
    first_name, last_name, student_code, sex,
    date_of_birth, current_shift_type, phone_number, homeroom_class_id,
  } = data;
  await pool.query(
    `UPDATE students
     SET
       first_name         = COALESCE(?, first_name),
       last_name          = COALESCE(?, last_name),
       student_code       = COALESCE(?, student_code),
       sex                = COALESCE(?, sex),
       date_of_birth      = COALESCE(?, date_of_birth),
       current_shift_type = COALESCE(?, current_shift_type),
       phone_number       = COALESCE(?, phone_number),
       homeroom_class_id  = COALESCE(?, homeroom_class_id)
     WHERE id = ? AND school_id = ?`,
    [
      first_name         ?? null,
      last_name          ?? null,
      student_code       ?? null,
      sex                ?? null,
      date_of_birth      ?? null,
      current_shift_type ?? null,
      phone_number       ?? null,
      homeroom_class_id  ?? null,
      id,
      schoolId,
    ]
  );
}

async function softDelete(id, schoolId) {
  await pool.query(
    `UPDATE students SET status = 'inactive' WHERE id = ? AND school_id = ?`,
    [id, schoolId]
  );
}

async function getAllStudents(schoolId, filters = {}) {
  const { class_id } = filters;

  let query = `
    SELECT
      s.id               AS student_id,
      u.id               AS user_id,
      u.email,
      u.first_name,
      u.last_name,
      s.student_code,
      s.sex,
      s.date_of_birth,
      s.current_shift_type,
      s.phone_number,
      s.status,
      s.homeroom_class_id,
      c.name             AS class_name,
      c.grade_level
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN classes c ON s.homeroom_class_id = c.id
    WHERE s.school_id = ? AND s.status = 'active'
  `;

  const params = [schoolId];

  if (class_id) {
    query += ' AND s.homeroom_class_id = ?';
    params.push(class_id);
  }

  query += ' ORDER BY u.last_name ASC, u.first_name ASC';

  const [rows] = await pool.query(query, params);
  return rows;
}

// Find an existing attendance record for a specific student + date + shift.
// Used by batchClockIn to decide insert vs update.
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

// INSERT a teacher batch record with an explicit date.
// Unlike insertClockIn, there is no clock_in time — the teacher is marking status only.
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

module.exports = {
  getStudentById, findStudent, findUserByEmail,
  insertUser, insertStudent, updateUser, updateStudent,
  softDelete, getAllStudents, findRecordForDate, insertBatchRecord,
};
