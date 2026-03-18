const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const AppError = require('../../utils/AppError');

// authMiddleware = security guard for protected routes
const authMiddleware = async (req, res, next) => {
  try {
    // 1) Read the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('Authorization header missing!', 401);
    }

    // 2) Must start with "Bearer "
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Invalid authorization format. Use Bearer token.', 401);
    }

    // 3) Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Token missing.', 401);
    }

    // 4) Check server is configured
    if (!process.env.JWT_SECRET) {
      throw new AppError('JWT secret not set on server.', 500);
    }

    // 5) Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      throw new AppError('Invalid or expired token!', 401);
    }

    // 6) Get user id from token
    const userId = decoded.id || decoded.userId;
    if (!userId) {
      throw new AppError('Invalid token payload.', 401);
    }

    // 7) Check that user still exists in DB
   // DB lookup — user still exists (wasn't deleted after token was issued

 
    const [rows] = await pool.query(
      `SELECT id, email, role, school_id
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    // validate of row exsits 

    if (rows.length === 0) {
      throw new AppError('User no longer exists.', 401);
    }

    const user = rows[0];

    // 8) Attach user info to request for later use
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id,
    };

    // 9) Let the request continue
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authMiddleware;

//"Every protected request triggers one database query just to check if the user exists. At high traffic, that's
  //thousands of unnecessary DB hits per second — a bottleneck that can slow down or crash the server."
