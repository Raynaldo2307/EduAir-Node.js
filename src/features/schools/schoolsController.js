const schoolsService = require('./schoolsService');

// PUBLIC — GET /api/schools
exports.getAllSchools = async (req, res, next) => {
  try {
    const rows = await schoolsService.getAll();
    return res.status(200).json({
      message: 'Schools fetched successfully',
      count: rows.length,
      data: rows,
    });
  } catch (err) { next(err); }
};

// PUBLIC — GET /api/schools/:id
exports.getSchoolById = async (req, res, next) => {
  try {
    const school = await schoolsService.getById(req.params.id);
    return res.status(200).json({
      message: 'School fetched successfully',
      data: school,
    });
  } catch (err) { next(err); }
};

// OPEN — POST /api/schools
exports.createSchool = async (req, res, next) => {
  try {
    const school = await schoolsService.create(req.body);
    return res.status(201).json({
      message: 'School created successfully',
      data: school,
    });
  } catch (err) { next(err); }
};

// ADMIN/PRINCIPAL — PUT /api/schools/me
exports.updateSchool = async (req, res, next) => {
  try {
    const school = await schoolsService.update(req.user.schoolId, req.user.id, req.body);
    return res.status(200).json({
      message: 'School updated successfully',
      data: school,
    });
  } catch (err) { next(err); }
};
