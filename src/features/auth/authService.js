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

  // 2) Find user by email
  const [rows] = await pool.query(
    `SELECT id, email, password_hash, first_name, last_name, role, school_id
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  if (rows.length === 0) {
    // Don't reveal whether email exists or password was wrong
    throw new AppError('Invalid credentials', 401);
  }

  const user = rows[0];

  // 3) Compare submitted password against stored hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  // 4) Sign JWT — payload matches what auth.middleware expects
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  // 5) Return token + safe user info (no password_hash)
  return {
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      schoolId: user.school_id,
    },
  };
}

// Admin-only: creates a user account for a student, teacher, or parent
// school_id comes from the logged-in admin's JWT — never from the request body
async function register(schoolId, body) {
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
    `SELECT id, email, first_name, last_name, role, school_id
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const user = rows[0];
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    schoolId: user.school_id,
  };
}

module.exports = { login, register, getMe };
