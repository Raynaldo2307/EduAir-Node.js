// Import the database connection pool
// pool.query() sends SQL to MySQL and gives back the results
const pool = require('../../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// getTeacherById(teacherId, schoolId)
// Fetches one complete teacher record by combining three tables:
//   teachers  — staff-specific info (shift, department, status, etc.)
//   users     — login info (email, name)
//   classes   — homeroom class name (if this teacher has one)
// ─────────────────────────────────────────────────────────────────────────────
async function getTeacherById(teacherId, schoolId) {
  // pool.query returns [rows, fields] — we only need rows, so we destructure [rows]
  const [rows] = await pool.query(
    `SELECT
       t.id                  AS teacher_id,        -- The teacher's primary key (from teachers table)
       u.id                  AS user_id,            -- The linked user's primary key (from users table)
       u.email,                                     -- Login email (stored in users)
       u.first_name,                                -- First name (stored in users)
       u.last_name,                                 -- Last name (stored in users)
       t.staff_code,                                -- Optional staff ID code (e.g. "TCH-001")
       t.department,                                -- Department the teacher belongs to
       t.employment_type,                           -- full_time / part_time / substitute / contract
       t.hire_date,                                 -- Date the teacher was hired
       t.current_shift_type,                        -- morning / afternoon / whole_day
       t.status,                                    -- 'active' or 'inactive'
       t.homeroom_class_id,                         -- Foreign key to the classes table (can be null)
       c.name                AS homeroom_class_name, -- The name of the homeroom class (from classes)
       c.grade_level                                 -- The grade level of the homeroom class
     FROM teachers t                                -- Start from the teachers table (aliased as 't')
     JOIN users u ON t.user_id = u.id              -- INNER JOIN: every teacher must have a user row
     LEFT JOIN classes c ON t.homeroom_class_id = c.id
     -- LEFT JOIN: include the teacher even if homeroom_class_id is null (no homeroom assigned)
     WHERE t.id = ? AND t.school_id = ?
     -- Filter by teacher ID AND school ID — prevents one school accessing another school's data
     LIMIT 1`,
    // The '?' placeholders are replaced with these values (prevents SQL injection)
    [teacherId, schoolId]
  );

  // rows[0] = the first (and only) result row
  // ?? null = if rows[0] is undefined (no record found), return null instead
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// findTeacher(id, schoolId)
// Lightweight existence check — only fetches id and user_id
// Used before update/delete to confirm the teacher exists in this school
// ─────────────────────────────────────────────────────────────────────────────
async function findTeacher(id, schoolId) {
  const [rows] = await pool.query(
    // Only select the two columns we actually need — faster than selecting everything
    'SELECT id, user_id FROM teachers WHERE id = ? AND school_id = ? LIMIT 1',
    [id, schoolId]
  );

  // Return the record if found, or null if not
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// findUserByEmail(email)
// Checks whether a user with this email already exists
// Used before inserting a new user to prevent duplicate emails
// ─────────────────────────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  const [rows] = await pool.query(
    // Only need the id — we just want to know IF the user exists
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  // Returns the user object (with just 'id') if found, or null if not
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// insertUser(data)
// Creates a new row in the 'users' table
// Returns the auto-generated ID of the newly created user
// ─────────────────────────────────────────────────────────────────────────────
async function insertUser(data) {
  // Destructure the fields we need from the data object
  const { email, passwordHash, first_name, last_name, schoolId } = data;

  const [result] = await pool.query(
    `INSERT INTO users
       (email, password_hash, first_name, last_name, role, school_id)
     VALUES (?, ?, ?, ?, 'teacher', ?)`,
    //                      ↑ role is HARDCODED as 'teacher'
    //                        You cannot create an admin through this function
    [email, passwordHash, first_name, last_name, schoolId]
  );

  // result.insertId = the auto-incremented primary key of the row just inserted
  // We need this to link the teachers row back to this user
  return result.insertId;
}

// ─────────────────────────────────────────────────────────────────────────────
// insertTeacher(data)
// Creates a new row in the 'teachers' table, linked to the user just created
// Returns the auto-generated ID of the new teacher record
// ─────────────────────────────────────────────────────────────────────────────
async function insertTeacher(data) {
  // Destructure all the teacher-specific fields
  const {
    schoolId,          // Which school this teacher belongs to
    userId,            // Foreign key → users.id (the user we just created)
    staff_code,        // Optional staff reference code
    department,        // Optional department name
    employment_type,   // Optional — defaults to 'full_time' if not given
    hire_date,         // Optional hire date
    current_shift_type, // Optional — defaults to 'whole_day' if not given
    homeroom_class_id, // Optional — which class they are homeroom teacher of
  } = data;

  const [result] = await pool.query(
    `INSERT INTO teachers
       (school_id, user_id, staff_code, department,
        employment_type, hire_date, current_shift_type, homeroom_class_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      schoolId,
      userId,
      staff_code         ?? null, // ?? null → if staff_code is undefined, store NULL in the DB
      department         ?? null,
      employment_type    ?? 'full_time',  // Default to 'full_time' if not provided
      hire_date          ?? null,
      current_shift_type ?? 'whole_day',  // Default to 'whole_day' if not provided
      homeroom_class_id  ?? null,
    ]
  );

  // Return the new teacher's auto-generated ID so the service can fetch the full record
  return result.insertId;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateUser(userId, data)
// Updates first_name and/or last_name in the users table
// Uses COALESCE so only provided fields are changed — others stay the same
// ─────────────────────────────────────────────────────────────────────────────
async function updateUser(userId, data) {
  // Only these two fields can be updated via this function
  const { first_name, last_name } = data;

  await pool.query(
    `UPDATE users
     SET
       first_name = COALESCE(?, first_name),
       -- COALESCE(newValue, currentValue):
       --   If newValue is NOT null → use the new value
       --   If newValue IS null     → keep the existing value in the database
       -- This allows partial updates: sending only first_name won't wipe out last_name
       last_name  = COALESCE(?, last_name)
     WHERE id = ?`,
    [
      first_name ?? null, // If first_name was not sent, pass null → COALESCE keeps existing value
      last_name  ?? null, // Same for last_name
      userId,             // Which user row to update
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTeacher(id, schoolId, data)
// Updates teacher-specific fields in the teachers table
// Uses COALESCE for the same partial-update behaviour as updateUser
// ─────────────────────────────────────────────────────────────────────────────
async function updateTeacher(id, schoolId, data) {
  // Destructure all the fields that can be updated
  const {
    staff_code,
    department,
    employment_type,
    hire_date,
    current_shift_type,
    homeroom_class_id,
  } = data;

  await pool.query(
    `UPDATE teachers
     SET
       staff_code         = COALESCE(?, staff_code),         -- Keep existing if not provided
       department         = COALESCE(?, department),
       employment_type    = COALESCE(?, employment_type),
       hire_date          = COALESCE(?, hire_date),
       current_shift_type = COALESCE(?, current_shift_type),
       homeroom_class_id  = COALESCE(?, homeroom_class_id)
     WHERE id = ? AND school_id = ?`,
    // Every ?? null converts undefined → null so COALESCE keeps the DB value
    [
      staff_code         ?? null,
      department         ?? null,
      employment_type    ?? null,
      hire_date          ?? null,
      current_shift_type ?? null,
      homeroom_class_id  ?? null,
      id,        // Which teacher record to update
      schoolId,  // Safety check: only update if teacher belongs to this school
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// softDelete(id, schoolId)
// "Deletes" a teacher by marking them as inactive — does NOT remove the DB row
// The teacher will no longer appear in getAllTeachers (which filters status = 'active')
// But all historical data (grades, attendance, etc.) that references them is preserved
// ─────────────────────────────────────────────────────────────────────────────
async function softDelete(id, schoolId) {
  await pool.query(
    // Simply set status to 'inactive' — that's the entire "delete"
    `UPDATE teachers SET status = 'inactive' WHERE id = ? AND school_id = ?`,
    [id, schoolId]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllTeachers(schoolId)
// Returns all ACTIVE teachers in a school, sorted alphabetically by name
// ─────────────────────────────────────────────────────────────────────────────
async function getAllTeachers(schoolId) {
  const [rows] = await pool.query(
    `SELECT
       t.id                  AS teacher_id,         -- Teacher's primary key
       u.id                  AS user_id,             -- Linked user's primary key
       u.email,                                      -- Login email
       u.first_name,                                 -- First name
       u.last_name,                                  -- Last name
       t.staff_code,                                 -- Staff reference code
       t.department,                                 -- Department
       t.employment_type,                            -- Employment type
       t.hire_date,                                  -- Hire date
       t.current_shift_type,                         -- Shift type
       t.status,                                     -- 'active' (all results will be 'active')
       t.homeroom_class_id,                          -- Homeroom class foreign key
       c.name                AS homeroom_class_name, -- Homeroom class name
       c.grade_level                                 -- Homeroom class grade level
     FROM teachers t
     JOIN users u ON t.user_id = u.id               -- Must have a linked user row
     LEFT JOIN classes c ON t.homeroom_class_id = c.id
     -- LEFT JOIN so teachers without a homeroom still appear in the list
     WHERE t.school_id = ? AND t.status = 'active'
     -- Only return teachers from this school AND only those who are still active
     ORDER BY u.last_name ASC, u.first_name ASC`,
     // Sort alphabetically: by last name first, then first name (e.g. "Adams, John" before "Adams, Mary")
    [schoolId]
  );

  // Return the full array of teacher objects
  return rows;
}

// Export every function so the service layer can import and use them
module.exports = {
  getTeacherById,   // Fetch one full teacher record
  findTeacher,      // Lightweight existence check
  findUserByEmail,  // Check for duplicate email
  insertUser,       // Create a new user row
  insertTeacher,    // Create a new teacher row
  updateUser,       // Update name fields in users table
  updateTeacher,    // Update staff fields in teachers table
  softDelete,       // Deactivate a teacher (set status = 'inactive')
  getAllTeachers,    // Fetch all active teachers in a school
};
