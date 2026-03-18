const bcrypt      = require('bcryptjs');
const AppError    = require('../../../utils/AppError');
const studentsRepo = require('./studentsRepository');

function validateCreateInput(body) {
  const { email, password, first_name, last_name, sex, current_shift_type } = body;

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
}

async function create(schoolId, body) {
  const {
    email, password, first_name, last_name,
    student_code, sex, date_of_birth,
    current_shift_type, phone_number, homeroom_class_id,
  } = body;

  // schoolId from JWT — multi-tenant safety
  validateCreateInput(body);

  // Check for duplicate email before inserting
  const existing = await studentsRepo.findUserByEmail(email);
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Insert into users table
  let userId;
  try {
    userId = await studentsRepo.insertUser({ email, passwordHash, first_name, last_name, schoolId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('A user with this email already exists', 409);
    }
    throw err;
  }

  // Insert into students table
  const studentId = await studentsRepo.insertStudent({
    schoolId, userId, first_name, last_name,
    student_code, sex, date_of_birth,
    current_shift_type, phone_number, homeroom_class_id,
  });

  // Return the newly created student
  return await studentsRepo.getStudentById(studentId, schoolId);
}

async function getAll(schoolId, filters = {}) {
  return await studentsRepo.getAllStudents(schoolId, filters);
}

async function getById(id, schoolId) {
  const student = await studentsRepo.getStudentById(id, schoolId);
  if (!student) throw new AppError('Student not found in your school', 404);
  return student;
}

async function update(id, schoolId, body) {
  const {
    first_name, last_name, student_code, sex,
    date_of_birth, current_shift_type, phone_number, homeroom_class_id,
  } = body;

  // 1) Validate enums if provided
  if (sex && !['male', 'female'].includes(sex)) {
    throw new AppError('sex must be male or female', 400);
  }
  if (current_shift_type && !['morning', 'afternoon', 'whole_day'].includes(current_shift_type)) {
    throw new AppError('current_shift_type must be morning, afternoon, or whole_day', 400);
  }

  // 2) Confirm student belongs to this school
  const existing = await studentsRepo.findStudent(id, schoolId);
  if (!existing) throw new AppError('Student not found in your school', 404);

  // 3) Update name fields on users table
  if (first_name || last_name) {
    await studentsRepo.updateUser(existing.user_id, { first_name, last_name });
  }

  // 4) Update profile fields on students table
  await studentsRepo.updateStudent(id, schoolId, {
    first_name, last_name, student_code, sex,
    date_of_birth, current_shift_type, phone_number, homeroom_class_id,
  });

  // 5) Return the updated record
  return await studentsRepo.getStudentById(id, schoolId);
}

async function remove(id, schoolId) {
  // Confirm student belongs to this school
  const existing = await studentsRepo.findStudent(id, schoolId);
  if (!existing) throw new AppError('Student not found in your school', 404);

  // Soft delete — preserve attendance history
  await studentsRepo.softDelete(id, schoolId);
}

module.exports = { create, getAll, getById, update, remove };
