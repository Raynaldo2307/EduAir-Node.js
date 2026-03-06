const express    = require('express');
const router     = express.Router();

const attendanceController = require('./attendanceController');
const authenticate         = require('../../middleware/auth.middleware');
const requireRole          = require('../../middleware/role.middleware');

// All attendance routes require a valid JWT
router.use(authenticate);

// ── Create ────────────────────────────────────────────────────────────────────
// POST /api/attendance/clock-in
// Student: self clock-in | Teacher/admin/principal: mark a student
router.post(
  '/clock-in',
  requireRole('student', 'teacher', 'admin', 'principal'),
  attendanceController.clockIn
);

// ── Read ──────────────────────────────────────────────────────────────────────
// GET /api/attendance?date=YYYY-MM-DD&shift_type=morning&class_id=1
// Returns all attendance for the school on a given date
router.get(
  '/',
  requireRole('teacher', 'admin', 'principal'),
  attendanceController.getAttendanceBySchool
);

// GET /api/attendance/student/:studentId?limit=14&shift_type=morning
// Student: own records only | Teacher/admin/principal: any student in school
// NOTE: must be declared before /:id routes to avoid 'student' matching as an id
router.get(
  '/student/:studentId',
  requireRole('student', 'teacher', 'admin', 'principal'),
  attendanceController.getStudentAttendance
);

// ── Update ────────────────────────────────────────────────────────────────────
// PUT /api/attendance/:id/clock-out
// Student: own record only | Teacher/admin/principal: any student in school
router.put(
  '/:id/clock-out',
  requireRole('student', 'teacher', 'admin', 'principal'),
  attendanceController.clockOut
);

// PUT /api/attendance/:id
// Correct status, add note, update late_reason_code — teacher/admin/principal only
router.put(
  '/:id',
  requireRole('teacher', 'admin', 'principal'),
  attendanceController.updateAttendance
);

// ── Delete ────────────────────────────────────────────────────────────────────
// DELETE /api/attendance/:id
// Admin/principal only — today's records only
router.delete(
  '/:id',
  requireRole('admin', 'principal'),
  attendanceController.deleteAttendance
);

module.exports = router;
