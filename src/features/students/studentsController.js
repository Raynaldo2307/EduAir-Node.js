const studentsService = require('./studentsService');

// POST /api/students
exports.createStudent = async (req, res, next) => {
  try {
    const student = await studentsService.create(req.user.schoolId, req.body);
    return res.status(201).json({
      message: 'Student enrolled successfully',
      data: student,
    });
  } catch (err) { next(err); }
};

// GET /api/students?class_id=X
exports.getAllStudents = async (req, res, next) => {
  try {
    const rows = await studentsService.getAll(req.user.schoolId, req.query);
    return res.status(200).json({
      message: 'Students fetched successfully',
      count: rows.length,
      data: rows,
    });
  } catch (err) { next(err); }
};

// GET /api/students/:id
exports.getStudentById = async (req, res, next) => {
  try {
    const student = await studentsService.getById(req.params.id, req.user.schoolId);
    return res.status(200).json({
      message: 'Student fetched successfully',
      data: student,
    });
  } catch (err) { next(err); }
};

// PUT /api/students/:id
exports.updateStudent = async (req, res, next) => {
  try {
    const student = await studentsService.update(req.params.id, req.user.schoolId, req.body);
    return res.status(200).json({
      message: 'Student updated successfully',
      data: student,
    });
  } catch (err) { next(err); }
};

// DELETE /api/students/:id
exports.deleteStudent = async (req, res, next) => {
  try {
    await studentsService.remove(req.params.id, req.user.schoolId);
    return res.status(200).json({ message: 'Student deactivated successfully' });
  } catch (err) { next(err); }
};
