// Load the Express framework so we can create routes
const express = require('express');

// Create a "mini router" — this handles all routes that start with /api/staff
const router = express.Router();

// Import the controller — this file has the functions that run when a route is hit
const staffController = require('./staffController');

// Import the authentication middleware — checks that the user is logged in (has a valid token)
const authenticate = require('../../middleware/auth.middleware');

// Import the role middleware — checks that the user has permission for a specific action
const requireRole = require('../../middleware/role.middleware');

// Apply authentication to ALL routes below this line
// This means: if you are not logged in, every request to /api/staff will be rejected
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DEFINITIONS
// Format: router.METHOD('path', roleGuard, controllerFunction)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/staff
// Returns a list of all active staff members in the school
// Only 'admin' or 'principal' roles are allowed to see the full staff list
router.get('/', requireRole('admin', 'principal'), staffController.getAllStaff);

// GET /api/staff/:id
// Returns one specific staff member by their ID (the number in the URL, e.g. /api/staff/7)
// 'admin', 'principal', AND 'teacher' can view a single staff record
router.get('/:id', requireRole('admin', 'principal', 'teacher'), staffController.getStaffById);

// POST /api/staff
// Creates a brand new staff member (teacher account)
// Only 'admin' or 'principal' can create staff
router.post('/', requireRole('admin', 'principal'), staffController.createStaff);

// PUT /api/staff/:id
// Updates an existing staff member's details (name, department, shift, etc.)
// Only 'admin' or 'principal' can make updates
router.put('/:id', requireRole('admin', 'principal'), staffController.updateStaff);

// DELETE /api/staff/:id
// Deactivates (soft-deletes) a staff member — does NOT permanently erase them from the DB
// Only 'admin' or 'principal' can deactivate staff
router.delete('/:id', requireRole('admin', 'principal'), staffController.deleteStaff);

// Export this router so it can be mounted in app.js under the /api/staff path
module.exports = router;
