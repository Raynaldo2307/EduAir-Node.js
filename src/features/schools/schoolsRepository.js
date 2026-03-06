const pool = require('../../../config/db');

// Single source of truth for which columns we return to the client.
// Every SELECT in this file uses this — change it once, it updates everywhere.
const SCHOOL_FIELDS = `
  id, name, moey_school_code, short_code, parish, school_type,
  is_shift_school, default_shift_type,
  latitude, longitude, radius_meters, timezone, is_active
`;

async function getSchoolById(id) {
  const [rows] = await pool.query(
    `SELECT ${SCHOOL_FIELDS} FROM schools WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function getAllSchools() {
  const [rows] = await pool.query(
    `SELECT ${SCHOOL_FIELDS} FROM schools WHERE is_active = 1 ORDER BY name ASC`
  );
  return rows;
}

async function insertSchool(data) {
  const {
    name, parish, school_type, moey_school_code, short_code,
    is_shift_school, default_shift_type, latitude, longitude,
    radius_meters, timezone,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO schools
       (name, parish, school_type, moey_school_code, short_code,
        is_shift_school, default_shift_type,
        latitude, longitude, radius_meters, timezone, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      name,
      parish,
      school_type,
      moey_school_code  ?? null,
      short_code        ?? null,
      is_shift_school   ? 1 : 0,
      default_shift_type,
      latitude          ?? null,
      longitude         ?? null,
      radius_meters,
      timezone,
    ]
  );
  return result.insertId;
}

async function updateSchool(schoolId, data) {
  const {
    name, parish, school_type, moey_school_code, short_code,
    is_shift_school, default_shift_type, latitude, longitude,
    radius_meters, timezone, is_active,
  } = data;

  const [result] = await pool.query(
    `UPDATE schools
     SET
       name               = COALESCE(?, name),
       parish             = COALESCE(?, parish),
       school_type        = COALESCE(?, school_type),
       moey_school_code   = COALESCE(?, moey_school_code),
       short_code         = COALESCE(?, short_code),
       is_shift_school    = COALESCE(?, is_shift_school),
       default_shift_type = COALESCE(?, default_shift_type),
       latitude           = COALESCE(?, latitude),
       longitude          = COALESCE(?, longitude),
       radius_meters      = COALESCE(?, radius_meters),
       timezone           = COALESCE(?, timezone),
       is_active          = COALESCE(?, is_active)
     WHERE id = ?`,
    [
      name               ?? null,
      parish             ?? null,
      school_type        ?? null,
      moey_school_code   ?? null,
      short_code         ?? null,
      is_shift_school    ?? null,
      default_shift_type ?? null,
      latitude           ?? null,
      longitude          ?? null,
      radius_meters      ?? null,
      timezone           ?? null,
      is_active          ?? null,
      schoolId,
    ]
  );
  return result.affectedRows;
}

module.exports = { getSchoolById, getAllSchools, insertSchool, updateSchool };
