// Import the staffService — all the real business logic lives there
// The controller just receives the request and sends back the response
const staffService = require('./staffService');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/staff  →  Create a new staff member
// ─────────────────────────────────────────────────────────────────────────────
exports.createStaff = async (req, res, next) => {
  // Wrap everything in try/catch so any error gets forwarded to the global error handler
  try {
    // req.user.schoolId → the school ID of the logged-in admin (set by auth middleware)
    // req.body          → the JSON data the client sent (email, password, name, etc.)
    const teacher = await staffService.create(req.user.schoolId, req.body);

    // 201 = HTTP "Created" — the resource was successfully created
    return res.status(201).json({
      message: 'Staff member created successfully', // Human-readable confirmation
      data: teacher,                                // The full teacher record just created
    });
  } catch (err) {
    // Pass the error to Express's error-handling middleware (defined in app.js)
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff  →  List all active staff in this school
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllStaff = async (req, res, next) => {
  try {
    // Fetch every active teacher that belongs to the logged-in user's school
    const rows = await staffService.getAll(req.user.schoolId);

    // 200 = HTTP "OK"
    return res.status(200).json({
      message: 'Staff fetched successfully',
      count: rows.length, // How many staff records were found
      data: rows,         // The array of teacher objects
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/:id  →  Get one specific staff member
// ─────────────────────────────────────────────────────────────────────────────
exports.getStaffById = async (req, res, next) => {
  try {
    // req.params.id → the value in the URL, e.g. /api/staff/7 gives us "7"
    // req.user.schoolId → ensures we only look inside the right school
    const teacher = await staffService.getById(req.params.id, req.user.schoolId);

    return res.status(200).json({
      message: 'Staff member fetched successfully',
      data: teacher, // The single teacher object
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/staff/:id  →  Update an existing staff member
// ─────────────────────────────────────────────────────────────────────────────
exports.updateStaff = async (req, res, next) => {
  try {
    // req.params.id   → which teacher to update
    // req.user.schoolId → confirm they belong to this school before updating
    // req.body          → the fields the client wants to change
    const teacher = await staffService.update(req.params.id, req.user.schoolId, req.body);

    return res.status(200).json({
      message: 'Staff member updated successfully',
      data: teacher, // The updated teacher record (freshly fetched from DB)
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/staff/:id  →  Deactivate a staff member (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteStaff = async (req, res, next) => {
  try {
    // This does NOT delete the row from the database
    // It sets status = 'inactive' so the teacher no longer appears in lists
    await staffService.remove(req.params.id, req.user.schoolId);

    // No 'data' returned — just a confirmation message
    return res.status(200).json({ message: 'Staff member deactivated successfully' });
  } catch (err) {
    next(err);
  }
};
