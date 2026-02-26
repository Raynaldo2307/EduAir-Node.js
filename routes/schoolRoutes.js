// routes/schoolRoutes.js
const express     = require('express');
const router      = express.Router();

const schoolController = require('../controllers/schoolController');
const authMiddleware   = require('../middleWare/authMiddleWare');
const requireRole      = require('../middleWare/roles.middleWare');

// PUBLIC — no token needed
// GET  /api/schools      — list all active schools (school selection dropdown)
// GET  /api/schools/:id  — get one school by id
// POST /api/schools      — register a new school
router.get('/',    schoolController.getAllSchools);
router.get('/:id', schoolController.getSchoolById);
router.post('/',   schoolController.createSchool);

// PROTECTED — token required from here down
router.use(authMiddleware);

// ADMIN/PRINCIPAL only — update their own school
// PUT /api/schools/me
router.put('/me', requireRole('admin', 'principal'), schoolController.updateSchool);

module.exports = router;
