const express    = require('express');
const router     = express.Router();

const schoolsController = require('./schoolsController');
const authenticate      = require('../../middleware/auth.middleware');
const requireRole       = require('../../middleware/role.middleware');

// PUBLIC — no token needed
// GET  /api/schools      — list all active schools (school selection dropdown)
// GET  /api/schools/:id  — get one school by id
// POST /api/schools      — register a new school
router.get('/',    schoolsController.getAllSchools);
router.get('/:id', schoolsController.getSchoolById);
router.post('/',   schoolsController.createSchool);

// PROTECTED — token required from here down
router.use(authenticate);

// ADMIN/PRINCIPAL only — update their own school
// PUT /api/schools/me
router.put('/me', requireRole('admin', 'principal'), schoolsController.updateSchool);

module.exports = router;
