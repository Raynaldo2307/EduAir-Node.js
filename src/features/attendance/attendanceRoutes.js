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

// POST /api/attendance/batch
// Teacher/admin marks a whole class at once for a given date + shift
router.post(
  '/batch',
  requireRole('teacher', 'admin', 'principal'),
  attendanceController.batchClockIn
);

// ── Read ──────────────────────────────────────────────────────────────────────
// GET /api/attendance?date=YYYY-MM-DD&shift_type=morning&class_id=1
// Returns all attendance for the school on a given date
router.get(
  '/',
  requireRole('teacher', 'admin', 'principal'),
  attendanceController.getAttendanceBySchool
);

// GET /api/attendance/today
// Student only — returns their own today's record using JWT identity (no studentId needed)
// NOTE: declared before /:id to avoid 'today' matching as a numeric id
router.get(
  '/today',
  requireRole('student'),
  attendanceController.getMyToday
);

// GET /api/attendance/me?limit=14&shift_type=morning
// Student only — returns their own history using JWT identity (no studentId needed)
// NOTE: declared before /:id to avoid 'me' matching as a numeric id
router.get(
  '/me',
  requireRole('student'),
  attendanceController.getMyHistory
);

// GET /api/attendance/class/:classId?shift_type=morning
// WHY: Teacher opens their attendance tab → app calls this with their homeroom class ID.
// Returns every student in the class + their attendance for today (marked or not).
// Optional ?shift_type filter: if the school runs shifts, the teacher picks which shift.
// NOTE: declared before /:id routes to prevent 'class' being treated as a numeric id.
router.get(
  '/class/:classId',
  requireRole('teacher', 'admin', 'principal'),
  attendanceController.getClassAttendance
);
 

// GET /api/attendance/stats?date=YYYY-MM-DD
// Returns present/late/absent/excused counts for the school on a given date.
// date defaults to today (Jamaica time) if not supplied.
// school_id comes from the JWT — admin can only see their own school.
// Used by: admin dashboard stat cards (Today Present, Absent Today).
router.get(
  '/stats',
  requireRole('admin', 'principal'),
  attendanceController.getStats
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
