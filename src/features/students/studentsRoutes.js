const express    = require('express');
const router     = express.Router();

const studentsController = require('./studentsController');
const authenticate       = require('../../middleware/auth.middleware');
const requireRole        = require('../../middleware/role.middleware');

// All student routes require a valid JWT
router.use(authenticate);

// GET /api/students        — list all students in the school (admin, principal, teacher)
// GET /api/students/:id    — get one student                (admin, principal, teacher)
// POST /api/students       — enrol a new student            (admin, principal only)
// PUT /api/students/:id    — update student profile         (admin, principal only)
// DELETE /api/students/:id — deactivate student             (admin, principal only)

router.get('/',       requireRole('admin', 'principal', 'teacher'), studentsController.getAllStudents);
router.get('/:id',    requireRole('admin', 'principal', 'teacher'), studentsController.getStudentById);
router.post('/',      requireRole('admin', 'principal'),            studentsController.createStudent);
router.put('/:id',    requireRole('admin', 'principal'),            studentsController.updateStudent);
router.delete('/:id', requireRole('admin', 'principal'),            studentsController.deleteStudent);

module.exports = router;
