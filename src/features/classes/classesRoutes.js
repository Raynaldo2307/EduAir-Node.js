// WHY: Routes define WHICH HTTP method + URL maps to WHICH controller function.
// Keeping routes in a separate file makes it easy to see the full API surface at a glance.
const express    = require('express');
const router     = express.Router();

const classesController = require('./classesController');
const authenticate      = require('../../middleware/auth.middleware');
const requireRole       = require('../../middleware/role.middleware');

// All class routes require a valid JWT — unauthenticated users cannot see class lists
router.use(authenticate);

// ── GET /api/classes ──────────────────────────────────────────────────────────
// WHY teacher is included: a teacher may need to browse classes when marking attendance.
// WHY student is NOT included: students don't need to pick classes — they are assigned one.
router.get(
  '/',
  requireRole('admin', 'principal', 'teacher'),
  classesController.getClasses
);

module.exports = router;
