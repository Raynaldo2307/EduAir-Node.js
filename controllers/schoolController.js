// controllers/schoolController.js
const pool = require('../config/db');
const AppError = require('../utils/AppError');

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_SCHOOL_TYPES = ['basic', 'primary', 'prep', 'secondary', 'all_age', 'heart_nta', 'other'];
const ALLOWED_SHIFT_TYPES  = ['morning', 'afternoon', 'whole_day'];

// Single source of truth for which columns we return to the client.
// Every SELECT in this file uses this — change it once, it updates everywhere.
const SCHOOL_FIELDS = `
  id, name, moey_school_code, short_code, parish, school_type,
  is_shift_school, default_shift_type,
  latitude, longitude, radius_meters, timezone, is_active
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Fetch a single school row by id. Used after INSERT and UPDATE to return clean data.
async function _getSchool(id) {
  const [rows] = await pool.query(
    `SELECT ${SCHOOL_FIELDS} FROM schools WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

// Validate school_type and default_shift_type.
// Pass only the fields you want to check — used by both create and update.
function _validateSchoolFields({ school_type, default_shift_type }) {
  if (school_type && !ALLOWED_SCHOOL_TYPES.includes(school_type)) {
    throw new AppError(
      `Invalid school_type. Allowed: ${ALLOWED_SCHOOL_TYPES.join(', ')}`,
      400
    );
  }
  if (default_shift_type && !ALLOWED_SHIFT_TYPES.includes(default_shift_type)) {
    throw new AppError(
      `Invalid default_shift_type. Allowed: ${ALLOWED_SHIFT_TYPES.join(', ')}`,
      400
    );
  }
}

// Shared ER_DUP_ENTRY handler — same message for create and update.
function _handleDupEntry(err, next) {
  if (err.code === 'ER_DUP_ENTRY') {
    return next(new AppError('A school with that name/parish or code already exists', 409));
  }
  return next(err);
}

// ─── Controllers ─────────────────────────────────────────────────────────────

// PUBLIC — GET /api/schools
// Returns all active schools for the Flutter school-selection dropdown.
// No auth — user hasn't logged in yet when they pick a school.
exports.getAllSchools = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${SCHOOL_FIELDS} FROM schools WHERE is_active = 1 ORDER BY name ASC`
    );

    return res.status(200).json({
      message: 'Schools fetched successfully',
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
};

// PUBLIC — GET /api/schools/:id
// Get one school by id. Used after login to load the current school config.
exports.getSchoolById = async (req, res, next) => {
  try {
    const school = await _getSchool(req.params.id);

    if (!school) {
      throw new AppError('School not found', 404);
    }

    return res.status(200).json({
      message: 'School fetched successfully',
      data: school,
    });
  } catch (err) {
    next(err);
  }
};

// OPEN — POST /api/schools
// Register a new school. No auth so schools can be set up before any users exist.
exports.createSchool = async (req, res, next) => {
  try {
    const {
      name,
      parish,
      school_type,
      moey_school_code,
      short_code,
      is_shift_school    = 0,
      default_shift_type = 'whole_day',
      latitude,
      longitude,
      radius_meters      = 150,
      timezone           = 'America/Jamaica',
    } = req.body;

    // 1) Required fields
    if (!name || !parish || !school_type) {
      throw new AppError('name, parish, and school_type are required', 400);
    }

    // 2) Validate enums
    _validateSchoolFields({ school_type, default_shift_type });

    // 3) Insert
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

    // 4) Return the new record
    const school = await _getSchool(result.insertId);

    return res.status(201).json({
      message: 'School created successfully',
      data: school,
    });
  } catch (err) {
    _handleDupEntry(err, next);
  }
};

// ADMIN/PRINCIPAL — PUT /api/schools/me
// Update the logged-in user's own school only.
// school_id and user id both come from the JWT — never from the client.
exports.updateSchool = async (req, res, next) => {
  try {
    const school_id = req.user.schoolId; // which school to update
    const user_id   = req.user.id;       // who is making the change (for future audit use)

    const {
      name,
      parish,
      school_type,
      moey_school_code,
      short_code,
      is_shift_school,
      default_shift_type,
      latitude,
      longitude,
      radius_meters,
      timezone,
      is_active,
    } = req.body;

    // 1) Validate enums if provided
    _validateSchoolFields({ school_type, default_shift_type });

    // 2) Update — COALESCE keeps the existing value for any field not sent
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
        school_id,
      ]
    );

    if (result.affectedRows === 0) {
      throw new AppError('School not found', 404);
    }

    // 3) Return the updated record
    const school = await _getSchool(school_id);

    return res.status(200).json({
      message: 'School updated successfully',
      data: school,
    });
  } catch (err) {
    _handleDupEntry(err, next);
  }
};
