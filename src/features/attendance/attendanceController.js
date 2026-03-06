const attendanceService = require('./attendanceService');

// POST /api/attendance/clock-in
exports.clockIn = async (req, res, next) => {
  try {
    const record = await attendanceService.clockIn(req.user, req.body);
    return res.status(201).json({ message: 'Clocked in successfully', data: record });
  } catch (err) { next(err); }
};

// PUT /api/attendance/:id/clock-out
exports.clockOut = async (req, res, next) => {
  try {
    const record = await attendanceService.clockOut(req.user, req.params, req.body);
    return res.status(200).json({ message: 'Clocked out successfully', data: record });
  } catch (err) { next(err); }
};

// PUT /api/attendance/:id
exports.updateAttendance = async (req, res, next) => {
  try {
    const record = await attendanceService.updateAttendance(req.user, req.params, req.body);
    return res.status(200).json({ message: 'Attendance updated successfully', data: record });
  } catch (err) { next(err); }
};

// GET /api/attendance
exports.getAttendanceBySchool = async (req, res, next) => {
  try {
    const { date, shift_type, rows } = await attendanceService.getBySchool(req.user, req.query);
    return res.status(200).json({
      message:    'Attendance fetched successfully',
      date,
      shift_type,
      count:      rows.length,
      data:       rows,
    });
  } catch (err) { next(err); }
};

// GET /api/attendance/student/:studentId
exports.getStudentAttendance = async (req, res, next) => {
  try {
    const rows = await attendanceService.getStudentHistory(req.user, req.params, req.query);
    return res.status(200).json({
      message: 'Student attendance fetched successfully',
      count:   rows.length,
      data:    rows,
    });
  } catch (err) { next(err); }
};

// DELETE /api/attendance/:id
exports.deleteAttendance = async (req, res, next) => {
  try {
    await attendanceService.deleteRecord(req.user, req.params);
    return res.status(200).json({ message: 'Attendance record deleted successfully' });
  } catch (err) { next(err); }
};
