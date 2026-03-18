const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../../../config/db');
const AppError = require('../../../utils/AppError');

const ALLOWED_ROLES = ['student', 'teacher', 'parent', 'admin', 'principal'];

// Public: login with email + password, returns JWT

async function login(email, password) {
  // 1) Both fields required
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  // 2) Find user by email — join both students and teachers so either role
  //    gets their class info in one query.
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role, u.school_id,
            s.default_shift_type, s.is_shift_school,
            st.student_code, st.current_shift_type AS student_shift_type, st.sex,
            sc.id   AS class_id,   sc.name  AS class_name,   sc.grade_level,
            t.homeroom_class_id   AS teacher_homeroom_class_id,
            t.current_shift_type  AS teacher_shift_type,
            tc.name               AS teacher_homeroom_class_name
     FROM users u
     LEFT JOIN schools s  ON s.id  = u.school_id
     LEFT JOIN students st ON st.user_id = u.id
     LEFT JOIN classes sc  ON sc.id = st.homeroom_class_id
     LEFT JOIN teachers t  ON t.user_id  = u.id
     LEFT JOIN classes tc  ON tc.id = t.homeroom_class_id
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );

  if (rows.length === 0) {
    // Don't reveal whether email exists or password was wrong
    ///That's credential enumeration prevention in code. One line. Same message every time.
    throw new AppError('Invalid credentials', 401);
  }

  const user = rows[0];

  // 3) Compare submitted password against stored hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    // That's credential enumeration prevention in code. One line. Same message every time.
    throw new AppError('Invalid credentials', 401);
  }

  // 4) Sign JWT — payload matches what auth.middleware expects
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
       //schoolId comes from the admin's JWT — req.user.schoolId
      schoolId: user.school_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  // 5) Return token + safe user info (no password_hash)
  // Payload includes everything downstream middleware needs.
  // . Returns token + safe user object (no hash)

  return {
    message: 'Login successful',
    token,
    user: {
      id:               user.id,
      email:            user.email,
      firstName:        user.first_name,
      lastName:         user.last_name,
      role:             user.role,
      schoolId:         user.school_id,
      defaultShiftType: user.default_shift_type          ?? null,
      isShiftSchool:    user.is_shift_school === 1,
      // Student fields
      studentId:        user.student_code                ?? null,
      currentShift:     user.student_shift_type          ?? user.teacher_shift_type ?? null,
      sex:              user.sex                         ?? null,
      classId:          user.class_id?.toString()        ?? null,
      className:        user.class_name                  ?? null,
      gradeLevel:       user.grade_level?.toString()     ?? null,
      // Teacher fields
      homeroomClassId:   user.teacher_homeroom_class_id?.toString() ?? null,
      homeroomClassName: user.teacher_homeroom_class_name           ?? null,
    },
  };
}

// Admin-only: creates a user account for a student, teacher, or parent
// school_id comes from the logged-in admin's JWT — never from the request body
async function register(schoolId, body) {
  //  get the user data
  const { email, password, first_name, last_name, role } = body;

  // 1) Basic required field validation
  if (!email || !password || !first_name || !last_name || !role) {
    throw new AppError('Missing required fields', 400);
  }

  // 2) Simple email + password validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Invalid email format', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  // 3) Check if email already exists
  const [existing] = await pool.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  if (existing.length > 0) {
    throw new AppError('Email already in use', 409);
  }

  // 4) Hash the password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 5) Insert user into DB  no is_active column in users table
  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO users
        (email, password_hash, first_name, last_name, role, school_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
       // INSERT INTO users — inserts with the hashed password, never the plain one
       // School id never come from the request body
      [email, passwordHash, first_name, last_name, role, schoolId]
    );
  } catch (err) {
    
    // Handle duplicate key from DB just in case of race condition
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('Email already in use', 409);
    }
    throw err;
  }

  // 6) Return clean user object WITHOUT password hash
  return {
    id: result.insertId,
    email,
    first_name,
    last_name,
    role,
    schoolId,
  };
}

// Protected: returns the current user's profile from DB using the JWT id
async function getMe(userId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.school_id,
            s.default_shift_type, s.is_shift_school,
            st.student_code, st.current_shift_type AS student_shift_type, st.sex,
            sc.id   AS class_id,   sc.name  AS class_name,   sc.grade_level,
            t.homeroom_class_id   AS teacher_homeroom_class_id,
            t.current_shift_type  AS teacher_shift_type,
            tc.name               AS teacher_homeroom_class_name
     FROM users u
     LEFT JOIN schools s  ON s.id  = u.school_id
     LEFT JOIN students st ON st.user_id = u.id
     LEFT JOIN classes sc  ON sc.id = st.homeroom_class_id
     LEFT JOIN teachers t  ON t.user_id  = u.id
     LEFT JOIN classes tc  ON tc.id = t.homeroom_class_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const user = rows[0];
  return {
    id:               user.id,
    email:            user.email,
    firstName:        user.first_name,
    lastName:         user.last_name,
    role:             user.role,
    schoolId:         user.school_id,
    defaultShiftType: user.default_shift_type          ?? null,
    isShiftSchool:    user.is_shift_school === 1,
    // Student fields
    studentId:        user.student_code                ?? null,
    currentShift:     user.student_shift_type          ?? user.teacher_shift_type ?? null,
    sex:              user.sex                         ?? null,
    classId:          user.class_id?.toString()        ?? null,
    className:        user.class_name                  ?? null,
    gradeLevel:       user.grade_level?.toString()     ?? null,
    // Teacher fields
    homeroomClassId:   user.teacher_homeroom_class_id?.toString() ?? null,
    homeroomClassName: user.teacher_homeroom_class_name           ?? null,
  };
}

// Any logged-in user updates their own profile.
// Updates users + students rows — userId comes from JWT, never from body.
async function updateMe(userId, body) {
  const { first_name, last_name, phone_number, sex, date_of_birth } = body;

  // Map Flutter sex code (M/F) → DB enum (male/female)
  const dbSex =
    sex === 'M' || sex === 'male'   ? 'male'   :
    sex === 'F' || sex === 'female' ? 'female' :
    null;

  // 1) Update users table (name lives here too)
  await pool.query(
    `UPDATE users SET
       first_name = COALESCE(?, first_name),
       last_name  = COALESCE(?, last_name)
     WHERE id = ?`,
    [first_name ?? null, last_name ?? null, userId]
  );

  // 2) Update students row (only if this user has one)
  await pool.query(
    `UPDATE students SET
       first_name    = COALESCE(?, first_name),
       last_name     = COALESCE(?, last_name),
       phone_number  = COALESCE(?, phone_number),
       sex           = COALESCE(?, sex),
       date_of_birth = COALESCE(?, date_of_birth)
     WHERE user_id = ?`,
    [
      first_name    ?? null,
      last_name     ?? null,
      phone_number  ?? null,
      dbSex,
      date_of_birth ?? null,
      userId,
    ]
  );

  return { message: 'Profile updated' };
}

module.exports = { login, register, getMe, updateMe };
