const AppError    = require('../../../utils/AppError');
const schoolsRepo = require('./schoolsRepository');

const ALLOWED_SCHOOL_TYPES = ['basic', 'primary', 'prep', 'secondary', 'all_age', 'heart_nta', 'other'];
const ALLOWED_SHIFT_TYPES  = ['morning', 'afternoon', 'whole_day'];

// Validate school_type and default_shift_type.
// Pass only the fields you want to check — used by both create and update.
function validateSchoolFields({ school_type, default_shift_type }) {
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
function handleDupEntry(err) {
  if (err.code === 'ER_DUP_ENTRY') {
    throw new AppError('A school with that name/parish or code already exists', 409);
  }
  throw err;
}

async function getAll() {
  return await schoolsRepo.getAllSchools();
}

async function getById(id) {
  const school = await schoolsRepo.getSchoolById(id);
  if (!school) throw new AppError('School not found', 404);
  return school;
}

async function create(body) {
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
  } = body;

  // 1) Required fields
  if (!name || !parish || !school_type) {
    throw new AppError('name, parish, and school_type are required', 400);
  }

  // 2) Validate enums
  validateSchoolFields({ school_type, default_shift_type });

  // 3) Insert + return new record
  try {
    const insertId = await schoolsRepo.insertSchool({
      name, parish, school_type, moey_school_code, short_code,
      is_shift_school, default_shift_type, latitude, longitude,
      radius_meters, timezone,
    });
    return await schoolsRepo.getSchoolById(insertId);
  } catch (err) {
    handleDupEntry(err);
  }
}

async function update(schoolId, userId, body) {
  const {
    name, parish, school_type, moey_school_code, short_code,
    is_shift_school, default_shift_type, latitude, longitude,
    radius_meters, timezone, is_active,
  } = body;

  // 1) Validate enums if provided
  validateSchoolFields({ school_type, default_shift_type });

  // 2) Update + return updated record
  try {
    const affectedRows = await schoolsRepo.updateSchool(schoolId, {
      name, parish, school_type, moey_school_code, short_code,
      is_shift_school, default_shift_type, latitude, longitude,
      radius_meters, timezone, is_active,
    });

    if (affectedRows === 0) throw new AppError('School not found', 404);
    return await schoolsRepo.getSchoolById(schoolId);
  } catch (err) {
    handleDupEntry(err);
  }
}

module.exports = { getAll, getById, create, update };
