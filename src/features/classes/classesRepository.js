// WHY: The database layer for classes.
// Repositories only run SQL — no business logic lives here.
// The controller calls the service, the service calls the repository.
const pool = require('../../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// getBySchool(schoolId)
// Returns all classes that belong to a given school.
// Used to populate dropdowns when admin is registering a student or teacher.
// WHY school_id filter: multi-tenant safety — a school can only see its own classes.
// ─────────────────────────────────────────────────────────────────────────────
async function getBySchool(schoolId) {
  // pool.query returns [rows, fields] — we only need rows, so we destructure [rows]
  const [rows] = await pool.query(
    `SELECT
       id,           -- The class's primary key (used as the value in Flutter dropdowns)
       name,         -- The class name e.g. "10A" (displayed to the user)
       grade_level   -- e.g. "Grade 10" (shown as a subtitle in the dropdown)
     FROM classes
     WHERE school_id = ?    -- Only return classes for THIS school
     ORDER BY grade_level ASC, name ASC`,
    // Sort by grade level first (Grade 10 before Grade 11),
    // then by name within the same grade (10A before 10B)
    [schoolId]
  );

  return rows;
}

// Export so the controller can import this function
module.exports = { getBySchool };
