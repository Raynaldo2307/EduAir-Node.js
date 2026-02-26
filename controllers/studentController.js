// controllers/studentController.js
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const AppError = require('../utils/AppError');

// ─── Helper ──────────────────────────────────────────────────────────────────

// Fetch a single student row by student id + school id.
// Used after INSERT and UPDATE to return clean, consistent data.
// LEFT JOIN classes so students without a class still appear.
async function _getStudent(studentId, schoolId) {
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

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * CREATE STUDENT
 * POST /api/students
 * Role: admin / principal only (enforced in routes)
 *
 * Flow:
 * 1) schoolId comes from JWT — never from the request body
 * 2) Validate required fields + email format + password length
 * 3) Check for duplicate email before inserting
 * 4) Hash password, insert into users, insert into students
 * 5) Return the new student record
 */
exports.createStudent = async (req, res, next) => {
  try {
    const { schoolId } = req.user; // from JWT — multi-tenant safety

    const {
      email,
      password,
      first_name,
      last_name,
      student_code,
      sex,
      date_of_birth,
      current_shift_type,
      phone_number,
      homeroom_class_id,
    } = req.body;

    // 1) Required fields
    if (!email || !password || !first_name || !last_name) {
      throw new AppError('email, password, first_name, and last_name are required', 400);
    }

    // 2) Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400);
    }

    // 3) Password length
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // 4) Validate sex enum if provided
    if (sex && !['male', 'female'].includes(sex)) {
      throw new AppError('sex must be male or female', 400);
    }

    // 5) Validate shift type if provided
    if (current_shift_type && !['morning', 'afternoon', 'whole_day'].includes(current_shift_type)) {
      throw new AppError('current_shift_type must be morning, afternoon, or whole_day', 400);
    }

    // 6) Check for duplicate email before inserting
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (existing.length > 0) {
      throw new AppError('A user with this email already exists', 409);
    }

    // 7) Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 8) Insert into users table
    const [userResult] = await pool.query(
      `INSERT INTO users
         (email, password_hash, first_name, last_name, role, school_id)
       VALUES (?, ?, ?, ?, 'student', ?)`,
      [email, passwordHash, first_name, last_name, schoolId]
    );

    const userId = userResult.insertId;

    // 9) Insert into students table — first_name + last_name are NOT NULL here too
    const [studentResult] = await pool.query(
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

    // 10) Return the newly created student
    const student = await _getStudent(studentResult.insertId, schoolId);

    return res.status(201).json({
      message: 'Student enrolled successfully',
      data: student,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return next(new AppError('A user with this email already exists', 409));
    }
    next(err);
  }
};

/**
 * GET ALL STUDENTS
 * GET /api/students
 * Role: admin, principal, teacher
 *
 * Returns all active students for the logged-in user's school.
 * Grade comes from the joined classes table — not a column on students.
 */
exports.getAllStudents = async (req, res, next) => {
  try {
    const { schoolId } = req.user;

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
       WHERE s.school_id = ? AND s.status = 'active'
       ORDER BY u.last_name ASC, u.first_name ASC`,
      [schoolId]
    );

    return res.status(200).json({
      message: 'Students fetched successfully',
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET ONE STUDENT
 * GET /api/students/:id
 * Role: admin, principal, teacher
 *
 * :id = students.id
 * school_id check ensures no cross-school data access.
 */
exports.getStudentById = async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const student = await _getStudent(id, schoolId);

    if (!student) {
      throw new AppError('Student not found in your school', 404);
    }

    return res.status(200).json({
      message: 'Student fetched successfully',
      data: student,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE STUDENT
 * PUT /api/students/:id
 * Role: admin, principal
 *
 * Updates users table (name) and students table (profile fields).
 * school_id from JWT ensures admin can only update students in their school.
 */
exports.updateStudent = async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const {
      first_name,
      last_name,
      student_code,
      sex,
      date_of_birth,
      current_shift_type,
      phone_number,
      homeroom_class_id,
    } = req.body;

    // 1) Validate enums if provided
    if (sex && !['male', 'female'].includes(sex)) {
      throw new AppError('sex must be male or female', 400);
    }
    if (current_shift_type && !['morning', 'afternoon', 'whole_day'].includes(current_shift_type)) {
      throw new AppError('current_shift_type must be morning, afternoon, or whole_day', 400);
    }

    // 2) Confirm student belongs to this school
    const [existingRows] = await pool.query(
      'SELECT id, user_id FROM students WHERE id = ? AND school_id = ? LIMIT 1',
      [id, schoolId]
    );
    if (existingRows.length === 0) {
      throw new AppError('Student not found in your school', 404);
    }

    const { user_id } = existingRows[0];

    // 3) Update name fields on users table
    if (first_name || last_name) {
      await pool.query(
        `UPDATE users
         SET
           first_name = COALESCE(?, first_name),
           last_name  = COALESCE(?, last_name)
         WHERE id = ?`,
        [first_name ?? null, last_name ?? null, user_id]
      );
    }

    // 4) Update profile fields on students table
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

    // 5) Return the updated record
    const student = await _getStudent(id, schoolId);

    return res.status(200).json({
      message: 'Student updated successfully',
      data: student,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * SOFT DELETE STUDENT
 * DELETE /api/students/:id
 * Role: admin, principal
 *
 * Sets status = 'inactive' — never hard deletes.
 * Hard delete would fail because attendance records FK reference students.id.
 */
exports.deleteStudent = async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    // 1) Confirm student belongs to this school
    const [existingRows] = await pool.query(
      'SELECT id FROM students WHERE id = ? AND school_id = ? LIMIT 1',
      [id, schoolId]
    );
    if (existingRows.length === 0) {
      throw new AppError('Student not found in your school', 404);
    }

    // 2) Soft delete — preserve attendance history
    await pool.query(
      `UPDATE students SET status = 'inactive' WHERE id = ? AND school_id = ?`,
      [id, schoolId]
    );

    return res.status(200).json({
      message: 'Student deactivated successfully',
    });
  } catch (err) {
    next(err);
  }
};
