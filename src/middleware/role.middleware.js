const AppError = require('../../utils/AppError');

/**
 * Role middleware for EduAir.
 *
 * Usage on a route:
 *   router.get(
 *     '/api/schools',
 *     authMiddleware,
 *     requireRole('admin', 'principal'),
 *     schoolController.listSchools
 *   );
 *
 * It expects authMiddleware to have already set:
 *   req.user = { id, email, role, schoolId }
 */
const requireRole = (...allowedRoles) => {
  // returned function is the real Express middleware
  return (req, res, next) => {
    try {
      // 1) Make sure authMiddleware ran first
      if (!req.user) {
        return next(new AppError('Not authenticated', 401));
      }

      // 2) Make sure the token / DB gave us a role
      const userRole = req.user.role;
      if (!userRole) {
        return next(new AppError('User role missing', 403));
      }

      // 3) Check if this role is allowed on this route
      if (!allowedRoles.includes(userRole)) {
        // Example: student trying to access an admin route
        return next(new AppError('Forbidden: insufficient permissions', 403));
      }

      // 4) All good → let the request continue
      return next();
    } catch (err) {
      return next(err);
    }
  };
};

module.exports = requireRole;
