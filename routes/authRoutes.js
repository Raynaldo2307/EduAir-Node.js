// routes/auth.routes.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleWare/authMiddleWare');
const requireRole = require('../middleWare/roles.middleWare');

// Public — no token needed
// POST /api/auth/login
router.post('/login', authController.login);

// Admin-only — protected: admin or principal creates user accounts
// POST /api/auth/register
router.post(
  '/register',
  authMiddleware,
  requireRole('admin', 'principal'),
  authController.register,
);

module.exports = router;
