// WHY: The controller is the bridge between the HTTP request and the business logic.
// It reads from req, calls the repository, and sends the response.
// It never writes SQL directly — that's the repository's job.
const classesRepo = require('./classesRepository');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/classes
// Returns all classes for the logged-in user's school.
// WHY: When admin registers a student or teacher, they pick a homeroom class
// from a dropdown. This endpoint feeds that dropdown.
// schoolId comes from req.user (set by the JWT auth middleware) — not from the URL.
// WHY: This prevents a school admin from requesting another school's classes.
// ─────────────────────────────────────────────────────────────────────────────
exports.getClasses = async (req, res, next) => {
  try {
    // req.user is populated by the authenticate middleware after it verifies the JWT
    // It contains: { id, schoolId, role, email }
    const { schoolId } = req.user;

    // Fetch all classes for this school from the database
    const classes = await classesRepo.getBySchool(schoolId);

    // Send back the list with a count — Flutter can use 'count' to check if the list is empty
    res.status(200).json({
      message: 'Classes fetched successfully',
      count:   classes.length,
      data:    classes,
    });
  } catch (err) {
    // Pass any error to the global error handler in app.js
    next(err);
  }
};
