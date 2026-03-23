// bcryptjs hashes passwords before saving to the database.
// We NEVER store plain-text passwords — always hash them first.
const bcrypt = require('bcryptjs');

// AppError is our custom error class with an HTTP status code attached.
const AppError = require('../../../utils/AppError');

// The repository handles all direct database queries.
const studentsRepo = require('./studentsRepository');

// WHY: We need the school's short_code and email_domain to auto-generate
// the student's email and student code. e.g. short_code='PAP', domain='papine.edu.jm'
const schoolsRepo = require('../schools/schoolsRepository');

// ─────────────────────────────────────────────────────────────────────────────
// generateStudentEmail(firstName, lastName, emailDomain)
// Creates the student's login email from their name + school domain.
// Pattern: {firstname}.{lastname}@student.{email_domain}
// Example: Tia Clarke at Papine → tia.clarke@student.papine.edu.jm
//
// WHY 'student.' subdomain: Separates student emails from teacher emails.
//   Teacher: mbrown@papine.edu.jm
//   Student: tia.clarke@student.papine.edu.jm
// This prevents a student from being confused for a teacher at a glance.
//
// Conflict resolution: if tia.clarke@ is taken, try tia.clarke2@, tia.clarke3@...
// ─────────────────────────────────────────────────────────────────────────────
async function generateStudentEmail(firstName, lastName, emailDomain) {
  // Lowercase and remove spaces from both names
  const firstLower = firstName.toLowerCase().replace(/\s+/g, '');
  const lastLower  = lastName.toLowerCase().replace(/\s+/g, '');

  // Build the base email: 'tia.clarke@student.papine.edu.jm'
  const base = `${firstLower}.${lastLower}@student.${emailDomain}`;

  // Check if this email is already in use
  const existing = await studentsRepo.findUserByEmail(base);

  // If free, use it — happy path
  if (!existing) return base;

  // Try adding a number suffix: tia.clarke2@..., tia.clarke3@...
  for (let i = 2; i <= 99; i++) {
    const candidate = `${firstLower}.${lastLower}${i}@student.${emailDomain}`;
    const taken = await studentsRepo.findUserByEmail(candidate);
    if (!taken) return candidate;
  }

  throw new AppError('Could not generate a unique email for this student', 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// generateStudentCode(schoolId, shortCode)
// Creates the student's ID code: {SHORT_CODE}-{YEAR}-{SEQUENCE}
// Example: PAP-2026-0001 (first student registered at Papine in 2026)
//          PAP-2026-0002 (second student registered at Papine in 2026)
//
// WHY include the year: Sequence resets each year. New intake = new year prefix.
// This matches how Jamaican schools issue student IDs in real life.
// ─────────────────────────────────────────────────────────────────────────────
async function generateStudentCode(schoolId, shortCode) {
  // Get the current calendar year: 2026, 2027, etc.
  const year = new Date().getFullYear();

  // Build the prefix: 'PAP-2026'
  const prefix = `${shortCode}-${year}`;

  // Count how many students already have a code starting with this prefix
  const count = await studentsRepo.countStudentsByYearPrefix(schoolId, prefix);

  // Next sequence number: count=0 → '0001', count=1 → '0002' (4 digits, zero-padded)
  const sequence = String(count + 1).padStart(4, '0');

  // Final code: 'PAP-2026-0003'
  return `${prefix}-${sequence}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateCreateInput(body)
// Validates what the admin sends when registering a student.
// WHY: Catch bad data before any DB writes happen.
// ─────────────────────────────────────────────────────────────────────────────
function validateCreateInput(body) {
  const { first_name, last_name, sex, current_shift_type } = body;

  // Name is required — we need it to auto-generate the email and student code
  if (!first_name || !last_name) {
    throw new AppError('first_name and last_name are required', 400);
  }

  // sex is optional — but if provided, must be 'male' or 'female'
  if (sex && !['male', 'female'].includes(sex)) {
    throw new AppError('sex must be male or female', 400);
  }

  // current_shift_type is optional — but if provided, must be a valid shift
  if (current_shift_type && !['morning', 'afternoon', 'whole_day'].includes(current_shift_type)) {
    throw new AppError('current_shift_type must be morning, afternoon, or whole_day', 400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create(schoolId, body)
// Registers a new student.
// Admin fills in: name, sex, date of birth, grade, homeroom class, shift.
// System auto-generates: email, student_code, and default password.
//
// WHY auto-generate:
//   - Consistent email format across the whole school
//   - No typos from manual entry
//   - Default password = student_code, so the admin can hand it to the student directly
// ─────────────────────────────────────────────────────────────────────────────
async function create(schoolId, body) {
  const {
    first_name,
    last_name,
    sex,               // Optional: 'male' or 'female'
    date_of_birth,     // Optional: used for age calculations and reports
    current_shift_type, // Optional: morning / afternoon / whole_day
    phone_number,      // Optional: student or guardian contact number
    homeroom_class_id, // Optional: which class the student belongs to
                       // Set during registration — can be changed later by admin
  } = body;

  // Validate — stops here if names are missing or enums are wrong
  validateCreateInput(body);

  // ── Step 1: Look up school details ────────────────────────────────────────
  const school = await schoolsRepo.getSchoolById(schoolId);
  if (!school) throw new AppError('School not found', 404);

  if (!school.short_code || !school.email_domain) {
    throw new AppError('School is missing short_code or email_domain. Contact your system administrator.', 500);
  }

  // ── Step 2: Auto-generate email ───────────────────────────────────────────
  // Pattern: tia.clarke@student.papine.edu.jm
  const email = await generateStudentEmail(first_name, last_name, school.email_domain);

  // ── Step 3: Auto-generate student code ────────────────────────────────────
  // Pattern: PAP-2026-0001
  const studentCode = await generateStudentCode(schoolId, school.short_code);

  // ── Step 4: Default password = student code ────────────────────────────────
  // WHY: Admin can hand the student their ID card and say "this IS your password".
  // Simple and practical for a school environment.
  const plainPassword = studentCode;
  const passwordHash  = await bcrypt.hash(plainPassword, 10);

  // ── Step 5: Print credentials to the server console ───────────────────────
  // The admin sees this in the terminal window running the Node.js server.
  // In a future phase, this could be printed as a PDF or sent via the Flutter UI.
  console.log('──────────────────────────────────────────');
  console.log('  NEW STUDENT CREDENTIALS');
  console.log(`  Name:     ${first_name} ${last_name}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${plainPassword}  (= student code)`);
  console.log('  ⚠ Give these to the student on first day. Ask them to change password.');
  console.log('──────────────────────────────────────────');

  // ── Step 6: Insert into database ─────────────────────────────────────────
  let userId;
  try {
    // Creates a row in 'users' with role = 'student' (hardcoded in repo)
    userId = await studentsRepo.insertUser({ email, passwordHash, first_name, last_name, schoolId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('A user with this email already exists', 409);
    }
    throw err;
  }

  // Creates a row in 'students' table linked to the user we just created
  const studentId = await studentsRepo.insertStudent({
    schoolId, userId, first_name, last_name,
    student_code: studentCode,
    sex, date_of_birth, current_shift_type, phone_number, homeroom_class_id,
  });

  // Return the full newly created student record
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
