// bcryptjs hashes passwords before they are saved to the database.
// We NEVER store plain-text passwords — always hash them first.
const bcrypt = require('bcryptjs');

// AppError is our custom error class with an HTTP status code attached.
// throw new AppError('message', 404) → the global handler sends a 404 response.
const AppError = require('../../../utils/AppError');

// The repository handles all direct database queries.
// The service calls the repo instead of writing SQL itself.
const staffRepo = require('./staffRepository');

// WHY: We need the school's short_code and email_domain to auto-generate
// the teacher's email and staff code. e.g. short_code='PAP', domain='papine.edu.jm'
const schoolsRepo = require('../schools/schoolsRepository');

// ─────────────────────────────────────────────────────────────────────────────
// ALLOWED VALUES — used for input validation
// ─────────────────────────────────────────────────────────────────────────────

// These are the only accepted values for the employment_type field
const VALID_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'substitute', 'contract'];

// These are the only accepted values for the current_shift_type field
const VALID_SHIFT_TYPES = ['morning', 'afternoon', 'whole_day'];

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT CODE MAP
// WHY: In Jamaica, staff codes include a department short code.
// e.g. A Mathematics teacher at Papine High gets: PAP-MATH-001
// This map converts the full department name to the short code used in the ID.
// ─────────────────────────────────────────────────────────────────────────────
const DEPT_CODES = {
  'Mathematics':            'MATH',
  'English':                'ENG',
  'Sciences':               'SCI',
  'Social Studies':         'SOC',
  'Physical Education':     'PE',
  'Information Technology': 'IT',
  'Business Studies':       'BUS',
  'Music / Arts':           'ART',
};

// ─────────────────────────────────────────────────────────────────────────────
// generateStaffEmail(firstName, lastName, emailDomain)
// Creates the teacher's login email from their name + school domain.
// Pattern: {first initial}{last name}@{email_domain}
// Example: Mark Brown at Papine → mbrown@papine.edu.jm
//
// WHY auto-generate: Consistent naming across the school. No typos. No confusion.
// Conflict resolution: if mbrown@... already exists, try mbrown2@..., mbrown3@... etc.
// ─────────────────────────────────────────────────────────────────────────────
async function generateStaffEmail(firstName, lastName, emailDomain) {
  // Take the first character of firstName and make it lowercase: 'Mark' → 'm'
  const initial = firstName.charAt(0).toLowerCase();

  // Make lastName lowercase and remove any spaces: 'St. John' → 'st.john'
  const lastLower = lastName.toLowerCase().replace(/\s+/g, '');

  // Build the base email: 'mbrown@papine.edu.jm'
  const base = `${initial}${lastLower}@${emailDomain}`;

  // Check if this email is already taken by another user in the system
  const existing = await staffRepo.findUserByEmail(base);

  // If the base email is free, use it — happy path
  if (!existing) return base;

  // Otherwise, try adding a number: mbrown2@..., mbrown3@..., up to mbrown99@...
  for (let i = 2; i <= 99; i++) {
    const candidate = `${initial}${lastLower}${i}@${emailDomain}`;
    const taken = await staffRepo.findUserByEmail(candidate);
    if (!taken) return candidate;
  }

  // Extremely unlikely — but if every variant is taken, throw an error
  throw new AppError('Could not generate a unique email for this staff member', 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// generateStaffCode(schoolId, shortCode, department)
// Creates the teacher's staff ID code: {SHORT_CODE}-{DEPT_CODE}-{SEQUENCE}
// Example: PAP-MATH-001 (first Math teacher at Papine)
//          PAP-MATH-002 (second Math teacher at Papine)
//
// WHY: Unique, readable IDs for staff. Used as default password and for reports.
// The sequence is based on how many codes with this prefix already exist in the DB.
// ─────────────────────────────────────────────────────────────────────────────
async function generateStaffCode(schoolId, shortCode, department) {
  // Look up the department's short code in our map
  // If the department isn't in the map (e.g. 'Drama'), fall back to 'GEN' (General)
  const deptCode = DEPT_CODES[department] || 'GEN';

  // Build the prefix that all codes for this dept share: 'PAP-MATH'
  const prefix = `${shortCode}-${deptCode}`;

  // Count how many teachers already have a code starting with this prefix
  // e.g. if PAP-MATH-001 and PAP-MATH-002 exist, count = 2
  const count = await staffRepo.countStaffByCodePrefix(schoolId, prefix);

  // The next sequence number: count=0 → '001', count=1 → '002', count=2 → '003'
  // padStart(3, '0') ensures it's always 3 digits: 1 → '001', 10 → '010'
  const sequence = String(count + 1).padStart(3, '0');

  // Combine into the final staff code: 'PAP-MATH-003'
  return `${prefix}-${sequence}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateCreateInput(body)
// Runs BEFORE creating a staff member — throws an error if anything is wrong.
// WHY: Catch bad data early, before any DB writes happen.
// ─────────────────────────────────────────────────────────────────────────────
function validateCreateInput(body) {
  const { first_name, last_name, employment_type, current_shift_type } = body;

  // First name and last name are required — we need them to generate the email
  if (!first_name || !last_name) {
    throw new AppError('first_name and last_name are required', 400);
  }

  // employment_type is optional — but if provided, must be a valid value
  if (employment_type && !VALID_EMPLOYMENT_TYPES.includes(employment_type)) {
    throw new AppError(`employment_type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`, 400);
  }

  // current_shift_type is optional — but if provided, must be a valid value
  if (current_shift_type && !VALID_SHIFT_TYPES.includes(current_shift_type)) {
    throw new AppError(`current_shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// create(schoolId, body)
// Registers a new teacher.
// The admin only provides the name + optional details.
// The system auto-generates: email, staff_code, and a default password.
//
// WHY auto-generate credentials:
//   - Consistent naming (no typos from manual entry)
//   - Admin simply tells the teacher: "Your login is mbrown@papine.edu.jm,
//     password is PAP-MATH-001. Change it when you first log in."
//   - Credentials are printed to the server console for the admin to see.
// ─────────────────────────────────────────────────────────────────────────────
async function create(schoolId, body) {
  const {
    first_name,
    last_name,
    department,        // Optional — used to build the staff code (e.g. 'Mathematics' → 'MATH')
    employment_type,   // Optional: full_time / part_time / substitute / contract
    hire_date,         // Optional: date the teacher was hired
    current_shift_type, // Optional: morning / afternoon / whole_day
    homeroom_class_id, // Optional: which class they are homeroom teacher of
                       // WHY optional: not every teacher in Jamaica is a form teacher
                       // e.g. a visiting specialist or a subject-only teacher has no homeroom
  } = body;

  // Run all validation checks — stops here with a 400 error if anything is wrong
  validateCreateInput(body);

  // ── Step 1: Look up school details ────────────────────────────────────────
  // WHY: We need the school's short_code and email_domain to generate credentials
  const school = await schoolsRepo.getSchoolById(schoolId);
  if (!school) throw new AppError('School not found', 404);

  // Safety check: if the school hasn't been set up with a short_code yet, stop here
  if (!school.short_code || !school.email_domain) {
    throw new AppError('School is missing short_code or email_domain. Contact your system administrator.', 500);
  }

  // ── Step 2: Auto-generate email ───────────────────────────────────────────
  // Pattern: mbrown@papine.edu.jm
  // Handles conflicts automatically (mbrown2@... if mbrown@ is taken)
  const email = await generateStaffEmail(first_name, last_name, school.email_domain);

  // ── Step 3: Auto-generate staff code ─────────────────────────────────────
  // Pattern: PAP-MATH-001
  const staffCode = await generateStaffCode(schoolId, school.short_code, department || 'General');

  // ── Step 4: Default password = staff code ─────────────────────────────────
  // WHY: Simple and memorable. Admin tells the teacher their staff code IS their first password.
  // The teacher should change it on first login (future feature).
  const plainPassword = staffCode;

  // Hash the password before storing it — bcrypt with 10 rounds is industry standard
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // ── Step 5: Print credentials to the console ──────────────────────────────
  // WHY console.log: The Flutter admin app will show a success dialog.
  // For now, the server console gives the admin the exact credentials to hand to the teacher.
  // In a future phase, this could be replaced with an email or SMS notification.
  console.log('──────────────────────────────────────────');
  console.log('  NEW STAFF CREDENTIALS');
  console.log(`  Name:     ${first_name} ${last_name}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${plainPassword}  (= staff code)`);
  console.log('  ⚠ Tell the teacher to change their password on first login.');
  console.log('──────────────────────────────────────────');

  // ── Step 6: Insert into database ─────────────────────────────────────────
  let userId;
  try {
    // Insert a row into the 'users' table (role is hardcoded to 'teacher' in the repo)
    userId = await staffRepo.insertUser({ email, passwordHash, first_name, last_name, schoolId });
  } catch (err) {
    // ER_DUP_ENTRY = MySQL error for duplicate unique value (race condition safety net)
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError('A user with this email already exists', 409);
    }
    throw err;
  }

  // Insert a row into the 'teachers' table, linked to the user we just created
  const teacherId = await staffRepo.insertTeacher({
    schoolId,
    userId,
    staff_code:        staffCode,
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
  return await staffRepo.getAllTeachers(schoolId);
}

// ─────────────────────────────────────────────────────────────────────────────
// getById(id, schoolId)
// Returns one staff member — throws 404 if not found in this school
// ─────────────────────────────────────────────────────────────────────────────
async function getById(id, schoolId) {
  const teacher = await staffRepo.getTeacherById(id, schoolId);
  if (!teacher) throw new AppError('Staff member not found in your school', 404);
  return teacher;
}

// ─────────────────────────────────────────────────────────────────────────────
// update(id, schoolId, body)
// Updates an existing teacher's details — supports partial updates.
// WHY partial: the admin shouldn't have to re-enter everything just to change a shift.
// ─────────────────────────────────────────────────────────────────────────────
async function update(id, schoolId, body) {
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

  if (employment_type && !VALID_EMPLOYMENT_TYPES.includes(employment_type)) {
    throw new AppError(`employment_type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`, 400);
  }

  if (current_shift_type && !VALID_SHIFT_TYPES.includes(current_shift_type)) {
    throw new AppError(`current_shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  // Confirm the teacher exists in this school before trying to update
  const existing = await staffRepo.findTeacher(id, schoolId);
  if (!existing) throw new AppError('Staff member not found in your school', 404);

  // Names are in the users table — update them there if provided
  if (first_name || last_name) {
    await staffRepo.updateUser(existing.user_id, { first_name, last_name });
  }

  // Staff-specific fields are in the teachers table
  await staffRepo.updateTeacher(id, schoolId, {
    staff_code,
    department,
    employment_type,
    hire_date,
    current_shift_type,
    homeroom_class_id,
  });

  return await staffRepo.getTeacherById(id, schoolId);
}

// ─────────────────────────────────────────────────────────────────────────────
// remove(id, schoolId)
// Soft-deletes a teacher by setting their status to 'inactive'.
// WHY soft delete: historical attendance records reference this teacher.
// Hard deleting would break the attendance history.
// ─────────────────────────────────────────────────────────────────────────────
async function remove(id, schoolId) {
  const existing = await staffRepo.findTeacher(id, schoolId);
  if (!existing) throw new AppError('Staff member not found in your school', 404);
  await staffRepo.softDelete(id, schoolId);
}

// Export all service functions so the controller can call them
module.exports = { create, getAll, getById, update, remove };
