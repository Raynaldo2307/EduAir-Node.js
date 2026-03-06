const express      = require('express');
const router       = express.Router();

const authController = require('./authController');
const authenticate   = require('../../middleware/auth.middleware');
const requireRole    = require('../../middleware/role.middleware');

// Public — no token needed
// POST /api/auth/login
router.post('/login', authController.login);

// Protected — verify token + return current user profile
// GET /api/auth/me
router.get('/me', authenticate, authController.me);

// Admin-only — protected: admin or principal creates user accounts
// POST /api/auth/register
router.post(
  '/register',
  authenticate,
  requireRole('admin', 'principal'),
  authController.register,
);

module.exports = router;
