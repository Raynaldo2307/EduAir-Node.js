// routes/studentRoutes.js
const express = require('express');
const router = express.Router();

const studentController = require('../controllers/studentController');
const authMiddleware    = require('../middleWare/authMiddleWare');
const requireRole       = require('../middleWare/roles.middleWare');

// All student routes require a valid JWT
router.use(authMiddleware);

// GET /api/students        — list all students in the school (admin, principal, teacher)
// GET /api/students/:id    — get one student                (admin, principal, teacher)
// POST /api/students       — enrol a new student            (admin, principal only)
// PUT /api/students/:id    — update student profile         (admin, principal only)
// DELETE /api/students/:id — deactivate student             (admin, principal only)

router.get('/',    requireRole('admin', 'principal', 'teacher'), studentController.getAllStudents);
router.get('/:id', requireRole('admin', 'principal', 'teacher'), studentController.getStudentById);
router.post('/',   requireRole('admin', 'principal'),            studentController.createStudent);
router.put('/:id', requireRole('admin', 'principal'),            studentController.updateStudent);
router.delete('/:id', requireRole('admin', 'principal'),         studentController.deleteStudent);

module.exports = router;
