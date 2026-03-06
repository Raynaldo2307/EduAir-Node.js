// bcryptjs is used to hash passwords before saving them to the database
// We NEVER store plain-text passwords — always hash them first
const bcrypt = require('bcryptjs');

// AppError is our custom error class — it lets us throw errors with an HTTP status code
// e.g. new AppError('Not found', 404) → sends a 404 response with that message
const AppError = require('../../../utils/AppError');

// The repository handles all direct database queries
// The service calls the repo instead of writing SQL itself
const staffRepo = require('./staffRepository');

// ─────────────────────────────────────────────────────────────────────────────
// ALLOWED VALUES — used for input validation
// ─────────────────────────────────────────────────────────────────────────────

// These are the only accepted values for the employment_type field
const VALID_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'substitute', 'contract'];

// These are the only accepted values for the current_shift_type field
const VALID_SHIFT_TYPES = ['morning', 'afternoon', 'whole_day'];

// ─────────────────────────────────────────────────────────────────────────────
// validateCreateInput(body)
// Runs before creating a staff member — throws an error if anything is wrong
// ─────────────────────────────────────────────────────────────────────────────
function validateCreateInput(body) {
  // Destructure the required fields out of the request body
  const { email, password, first_name, last_name, employment_type, current_shift_type } = body;

  // All four of these fields are mandatory — throw a 400 Bad Request if any are missing
  if (!email || !password || !first_name || !last_name) {
    throw new AppError('email, password, first_name, and last_name are required', 400);
  }

  // A simple email regex: must have characters, then @, then characters, then ., then characters
  // This catches obvious typos like "notanemail" or "missing@dot"
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Test the email against the regex — throw 400 if it doesn't match
  if (!emailRegex.test(email)) {
    throw new AppError('Invalid email format', 400);
  }

  // Passwords must be at least 8 characters long for basic security
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // employment_type is optional — but if it IS provided, it must be one of the valid values
  if (employment_type && !VALID_EMPLOYMENT_TYPES.includes(employment_type)) {
    // Join the array into a readable string like: "full_time, part_time, substitute, contract"
    throw new AppError(`employment_type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`, 400);
  }

  // Same rule for current_shift_type — optional, but must be valid if provided
  if (current_shift_type && !VALID_SHIFT_TYPES.includes(current_shift_type)) {
    throw new AppError(`current_shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create(schoolId, body)
// Creates a new teacher: validates input, hashes password, inserts two DB rows
// Returns the full teacher record
// ─────────────────────────────────────────────────────────────────────────────
async function create(schoolId, body) {
  // Pull out all the fields we expect from the request body
  const {
    email,             // Teacher's login email (required)
    password,          // Plain-text password — will be hashed before saving (required)
    first_name,        // Teacher's first name (required)
    last_name,         // Teacher's last name (required)
    staff_code,        // Optional staff ID code (e.g. "TCH-001")
    department,        // Optional department name (e.g. "Mathematics")
    employment_type,   // Optional: full_time / part_time / substitute / contract
    hire_date,         // Optional: date the teacher was hired
    current_shift_type, // Optional: morning / afternoon / whole_day
    homeroom_class_id, // Optional: ID of the class this teacher is homeroom teacher for
  } = body;

  // Run all the validation checks — throws an error and stops here if anything is wrong
  validateCreateInput(body);

  // Check if a user with this email already exists in the database
  const existing = await staffRepo.findUserByEmail(email);

  // If a record was found, we cannot create a duplicate — throw 409 Conflict
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  // Hash the plain-text password using bcrypt
  // The '10' is the "salt rounds" — higher = more secure but slower (10 is standard)
  const passwordHash = await bcrypt.hash(password, 10);

  // We'll store the new user's ID here after inserting
  let userId;

  try {
    // Insert a row into the 'users' table with role = 'teacher'
    // Returns the new user's auto-generated ID
    userId = await staffRepo.insertUser({ email, passwordHash, first_name, last_name, schoolId });
  } catch (err) {
    // ER_DUP_ENTRY = MySQL error when trying to insert a duplicate unique value
    // This is a race-condition safety net in case two requests come in at the same time
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('A user with this email already exists', 409);
    }
    // For any other DB error, re-throw it so the global handler can deal with it
    throw err;
  }

  // Insert a row into the 'teachers' table, linked to the user we just created
  // Returns the new teacher's auto-generated ID
  const teacherId = await staffRepo.insertTeacher({
    schoolId,          // Which school this teacher belongs to
    userId,            // Links to the users table row we just created
    staff_code,
    department,
    employment_type,
    hire_date,
    current_shift_type,
    homeroom_class_id,
  });

  // Fetch and return the full combined teacher record (joins users + teachers + classes)
  return await staffRepo.getTeacherById(teacherId, schoolId);
}

// ─────────────────────────────────────────────────────────────────────────────
// getAll(schoolId)
// Returns all active staff in the given school
// ─────────────────────────────────────────────────────────────────────────────
async function getAll(schoolId) {
  // Delegate straight to the repo — no business logic needed here
  return await staffRepo.getAllTeachers(schoolId);
}

// ─────────────────────────────────────────────────────────────────────────────
// getById(id, schoolId)
// Returns one staff member — throws 404 if not found in this school
// ─────────────────────────────────────────────────────────────────────────────
async function getById(id, schoolId) {
  // Look up the teacher by their ID, scoped to this school
  const teacher = await staffRepo.getTeacherById(id, schoolId);

  // If nothing was found, return a 404 error
  // "in your school" → a school cannot accidentally see another school's staff
  if (!teacher) throw new AppError('Staff member not found in your school', 404);

  // Return the teacher record if found
  return teacher;
}

// ─────────────────────────────────────────────────────────────────────────────
// update(id, schoolId, body)
// Updates an existing teacher's details — supports partial updates
// ─────────────────────────────────────────────────────────────────────────────
async function update(id, schoolId, body) {
  // Pull out the fields the client wants to update
  // All of these are optional — only provided fields will be changed
  const {
    first_name,
    last_name,
    staff_code,
    department,
    employment_type,
    hire_date,
    current_shift_type,
    homeroom_class_id,
  } = body;

  // Validate employment_type if it was provided in the request
  if (employment_type && !VALID_EMPLOYMENT_TYPES.includes(employment_type)) {
    throw new AppError(`employment_type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`, 400);
  }

  // Validate current_shift_type if it was provided in the request
  if (current_shift_type && !VALID_SHIFT_TYPES.includes(current_shift_type)) {
    throw new AppError(`current_shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  // Confirm the teacher exists in this school before trying to update
  // findTeacher returns a lightweight { id, user_id } object or null
  const existing = await staffRepo.findTeacher(id, schoolId);

  // If not found, throw 404 — can't update someone who doesn't exist (or belongs to another school)
  if (!existing) throw new AppError('Staff member not found in your school', 404);

  // If either name field was provided, update the users table
  // (names are stored in 'users', not in 'teachers')
  if (first_name || last_name) {
    // existing.user_id → the users table row linked to this teacher
    await staffRepo.updateUser(existing.user_id, { first_name, last_name });
  }

  // Update the teachers table with the remaining fields
  // Fields not provided will stay unchanged (COALESCE handles this in the SQL)
  await staffRepo.updateTeacher(id, schoolId, {
    staff_code,
    department,
    employment_type,
    hire_date,
    current_shift_type,
    homeroom_class_id,
  });

  // Fetch and return the fully updated record from the database
  return await staffRepo.getTeacherById(id, schoolId);
}

// ─────────────────────────────────────────────────────────────────────────────
// remove(id, schoolId)
// Soft-deletes a teacher by setting their status to 'inactive'
// The row stays in the database — it just disappears from all lists
// ─────────────────────────────────────────────────────────────────────────────
async function remove(id, schoolId) {
  // Confirm the teacher exists in this school before deactivating
  const existing = await staffRepo.findTeacher(id, schoolId);

  // If not found, throw 404
  if (!existing) throw new AppError('Staff member not found in your school', 404);

  // Set status = 'inactive' in the DB — this is the "soft delete"
  await staffRepo.softDelete(id, schoolId);
}

// Export all service functions so the controller can call them
module.exports = { create, getAll, getById, update, remove };
