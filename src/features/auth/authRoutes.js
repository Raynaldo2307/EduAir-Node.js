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

// Protected — any logged-in user updates their own profile
// PUT /api/auth/me
router.put('/me', authenticate, authController.updateMe);

// Admin-only — protected: admin or principal creates user accounts
// POST /api/auth/register
router.post(
  '/register',
  authenticate,
  requireRole('admin', 'principal'),
  authController.register,
);
// Public - request a password reset code
// Post /api/auth/forgot-password
router.post('/forgot-password', authController.forgotPassword);

// Pkublic - verify. code and set new password
// Post /api/auth/reset-password
router.post('/reset-password',
authController.resetPassword);


module.exports = router;
