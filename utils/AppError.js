// utils/AppError.js
// Custom error class for all operational errors in EduAir API
// "Operational" = errors we expect and handle (wrong token, not found, etc.)
// vs unexpected crashes (null reference, DB down) which have isOperational = false

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

module.exports = AppError;
