const pool           = require('../../../config/db');
const AppError       = require('../../../utils/AppError');
const attendanceRepo = require('./attendanceRepository');

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_SHIFT_TYPES  = ['morning', 'afternoon', 'whole_day'];
const VALID_STATUSES     = ['present', 'late', 'absent', 'early', 'excused'];
const VALID_LATE_REASONS = ['transportation', 'economic', 'illness', 'emergency', 'family', 'other'];

// Shift boundaries (Jamaica time, 24h format).
//
// ADD (Claude — Mar 1 2026):
//   Added endH/endM to each shift so clock-out can compute is_early_leave.
//   End times match the Flutter AttendanceService._classEndFor() exactly:
//     morning   → ends 12:00 PM
//     afternoon → ends  5:00 PM
//     whole_day → ends  4:00 PM
const SHIFT_BOUNDARIES = {
  morning:   { startH: 7,  startM: 0,  graceH: 7,  graceM: 30, endH: 12, endM: 0  },
  afternoon: { startH: 12, startM: 0,  graceH: 12, graceM: 30, endH: 17, endM: 0  },
  whole_day: { startH: 8,  startM: 0,  graceH: 8,  graceM: 30, endH: 16, endM: 0  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Current date as YYYY-MM-DD in Jamaica timezone (UTC-5, no DST)
function jamaicaDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Jamaica' });
}

// Current time object in Jamaica timezone
function jamaicaTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Jamaica' }));
}

// Determine attendance status based on Jamaica time vs shift grace period.
//
// FIX (Claude — Mar 1 2026):
//   Was returning 'present' for on-time clock-ins.
//   Changed to 'early' to match the Flutter AttendanceStatus enum and
//   the EduAir domain model — where 'early' means arrived within the
//   grace window, and 'present' is reserved for manual overrides only.
//
//   Flutter model:  early = within grace | late = after grace
//   Node backend:   early = within grace | late = after grace  ← now matches
//
// If the shift is not recognised, we default to 'early' (safe fallback).
function resolveStatus(shiftType, now) {
  const bounds = SHIFT_BOUNDARIES[shiftType];
  if (!bounds) return 'early'; // unknown shift — safe default
  const nowMinutes   = now.getHours() * 60 + now.getMinutes();
  const graceMinutes = bounds.graceH * 60 + bounds.graceM;
  return nowMinutes > graceMinutes ? 'late' : 'early';
}

// Validate lat/lng values
function validateCoords(lat, lng) {
  if (lat !== undefined && (isNaN(Number(lat)) || Math.abs(Number(lat)) > 90)) {
    throw new AppError('Invalid latitude - must be between -90 and 90', 400);
  }
  if (lng !== undefined && (isNaN(Number(lng)) || Math.abs(Number(lng)) > 180)) {
    throw new AppError('Invalid longitude — must be between -180 and 180', 400);
  }
}

// Resolve audit source string from role
function resolveSource(role) {
  if (role === 'student')                          return 'studentSelf';
  if (role === 'admin' || role === 'principal')    return 'adminEdit';
  return 'teacherBatch';
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * CLOCK IN
 * Student role  → self clock-in.  student_id derived from req.user.id.
 * Teacher/admin → must supply student_id in body. Source = teacherBatch/adminEdit.
 */
async function clockIn(user, body) {
  const { id: userId, schoolId, role } = user;
  const {
    shift_type,
    student_id:  bodyStudentId,
    clock_in_lat,
    clock_in_lng,
    device_id,
    late_reason_code,
    note,
  } = body;

  // 1) shift_type — required, must be valid
  if (!shift_type) {
    throw new AppError('shift_type is required', 400);
  }
  if (!VALID_SHIFT_TYPES.includes(shift_type)) {
    throw new AppError(`shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  // 2) Validate coordinates if provided
  validateCoords(clock_in_lat, clock_in_lng);

  // 3) Resolve which student is being clocked in
  let student;
  const source = resolveSource(role);

  if (role === 'student') {
    student = await attendanceRepo.getStudentByUserId(userId, schoolId);
    if (!student) {
      throw new AppError('No student profile found for your account', 404);
    }
  } else {
    // Teacher / admin must supply student_id in body
    if (!bodyStudentId) {
      throw new AppError('student_id is required when marking attendance as teacher or admin', 400);
    }
    student = await attendanceRepo.getStudentById(bodyStudentId, schoolId);
    if (!student) {
      throw new AppError('Student not found in your school', 404);
    }
  }

  // 4) Student must be active
  if (student.status !== 'active') {
    throw new AppError('Cannot record attendance for an inactive student', 400);
  }

  // 5) Determine status from Jamaica time
  const now    = jamaicaTime();
  const status = resolveStatus(shift_type, now);

  // 6) Late requires a reason code
  if (status === 'late') {
    if (!late_reason_code) {
      throw new AppError('late_reason_code is required when the student is late', 400);
    }
    if (!VALID_LATE_REASONS.includes(late_reason_code)) {
      throw new AppError(`late_reason_code must be one of: ${VALID_LATE_REASONS.join(', ')}`, 400);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 7) Insert — MySQL unique constraint prevents double clock-in
    let insertId;
    try {
      insertId = await attendanceRepo.insertClockIn({
        schoolId,
        studentId:       student.id,
        classId:         student.homeroom_class_id,
        userId,
        shift_type,
        clock_in_lat,
        clock_in_lng,
        status,
        source,
        late_reason_code,
        device_id,
        note,
      }, conn);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('Already clocked in for this shift today', 409);
      }
      throw err;
    }

    // 8) Audit trail — initial clock-in row
    await attendanceRepo.writeHistory({
      attendanceId:    insertId,
      previousStatus:  null,
      newStatus:       status,
      changedByUserId: userId,
      source,
    }, conn);

    await conn.commit();
    return await attendanceRepo.getRecord(insertId, schoolId);

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * CLOCK OUT
 * Student  → can only clock out their own record.
 * Teacher / admin / principal → can clock out any student in their school.
 */
async function clockOut(user, params, body) {
  const { id: userId, schoolId, role } = user;
  const { id }                         = params;
  const { clock_out_lat, clock_out_lng } = body;

  // 1) Validate coordinates if provided
  validateCoords(clock_out_lat, clock_out_lng);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 2) Fetch the record — join students so we can check user_id for student role
    const record = await attendanceRepo.getRecordForClockOut(id, schoolId, conn);

    if (!record) {
      throw new AppError('Attendance record not found', 404);
    }

    // 3) Student can only clock out their own record
    if (role === 'student' && record.user_id !== userId) {
      throw new AppError('You can only clock out your own attendance', 403);
    }

    // 4) Must have clocked in first
    if (!record.clock_in) {
      throw new AppError('Cannot clock out no clock-in found for this record', 400);
    }

    // 5) Already clocked out
    if (record.clock_out) {
      throw new AppError('Already clocked out for this shift', 409);
    }

    const source = resolveSource(role);

    // 6) Compute is_early_leave from Jamaica server time vs shift end time.
    //
    // ADD (Claude — Mar 1 2026):
    //   is_early_leave was never being calculated or written on clock-out.
    //   The DB column existed but was always NULL.
    //   Now we compare current Jamaica time to the shift end time from
    //   SHIFT_BOUNDARIES — matches Flutter's AttendanceService._classEndFor().
    const now            = jamaicaTime();
    const bounds         = SHIFT_BOUNDARIES[record.shift_type];
    let   isEarlyLeave   = false;

    if (bounds) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const endMinutes = bounds.endH * 60 + bounds.endM;
      isEarlyLeave     = nowMinutes < endMinutes; // left before shift end
    }

    // 7) Update — time always from server, is_early_leave now included
    await attendanceRepo.updateClockOut(id, schoolId, { clock_out_lat, clock_out_lng, isEarlyLeave }, conn);

    // 7) Audit trail — status unchanged, clock-out event recorded
    await attendanceRepo.writeHistory({
      attendanceId:    record.id,
      previousStatus:  record.status,
      newStatus:       record.status,
      changedByUserId: userId,
      source,
    }, conn);

    await conn.commit();
    return await attendanceRepo.getRecord(id, schoolId);

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * UPDATE ATTENDANCE STATUS
 * Used for: correcting status, adding excused note, marking absent.
 * Always writes to attendance_history.
 */
async function updateAttendance(user, params, body) {
  const { id: userId, schoolId, role } = user;
  const { id }                         = params;
  const { status, late_reason_code, note } = body;

  // 1) At least one field required
  if (!status && !late_reason_code && note === undefined) {
    throw new AppError('Provide at least one field to update: status, late_reason_code, or note', 400);
  }

  // 2) Validate status enum
  if (status && !VALID_STATUSES.includes(status)) {
    throw new AppError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
  }

  // 3) Late requires reason code
  if (status === 'late' && !late_reason_code) {
    throw new AppError('late_reason_code is required when setting status to late', 400);
  }
  if (late_reason_code && !VALID_LATE_REASONS.includes(late_reason_code)) {
    throw new AppError(`late_reason_code must be one of: ${VALID_LATE_REASONS.join(', ')}`, 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 4) Fetch existing record
    const existing = await attendanceRepo.getRecordForUpdate(id, schoolId, conn);

    if (!existing) {
      throw new AppError('Attendance record not found', 404);
    }

    const previousStatus = existing.status;
    const newStatus      = status ?? previousStatus;
    const source         = resolveSource(role);

    // 5) Update
    await attendanceRepo.updateStatus(id, schoolId, {
      status, late_reason_code, note, userId,
    }, conn);

    // 6) Audit trail — always write when teacher/admin changes a record
    await attendanceRepo.writeHistory({
      attendanceId:    existing.id,
      previousStatus,
      newStatus,
      changedByUserId: userId,
      source,
    }, conn);

    await conn.commit();
    return await attendanceRepo.getRecord(id, schoolId);

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * GET ATTENDANCE BY SCHOOL / DATE / SHIFT
 * date defaults to today (Jamaica time).
 * shift_type and class_id are optional filters.
 */
async function getBySchool(user, query) {
  const { schoolId }                   = user;
  const { date, shift_type, class_id } = query;

  // Validate date format
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('date must be in YYYY-MM-DD format', 400);
  }

  // Validate shift_type
  if (shift_type && !VALID_SHIFT_TYPES.includes(shift_type)) {
    throw new AppError(`shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  const targetDate = date ?? jamaicaDateKey();
  const rows = await attendanceRepo.getAttendanceBySchool(schoolId, targetDate, { shift_type, class_id });

  return { date: targetDate, shift_type: shift_type ?? 'all', rows };
}

/**
 * GET STUDENT ATTENDANCE HISTORY
 * Query params:
 *   limit      — number of records returned (1–90, default 14)
 *   shift_type — optional filter
 */
async function getStudentHistory(user, params, query) {
  const { id: userId, schoolId, role } = user;
  const { studentId }                  = params;
  const { limit = 14, shift_type }     = query;

  // Validate limit
  const parsedLimit = parseInt(limit, 10);
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 90) {
    throw new AppError('limit must be a number between 1 and 90', 400);
  }

  // Validate shift_type
  if (shift_type && !VALID_SHIFT_TYPES.includes(shift_type)) {
    throw new AppError(`shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  // Confirm student exists in this school
  const student = await attendanceRepo.getStudentById(studentId, schoolId);

  if (!student) {
    throw new AppError('Student not found in your school', 404);
  }

  // Students can only view their own records
  if (role === 'student' && student.user_id !== userId) {
    throw new AppError('You can only view your own attendance records', 403);
  }

  return await attendanceRepo.getStudentHistory(studentId, schoolId, { shift_type, limit: parsedLimit });
}

/**
 * DELETE ATTENDANCE RECORD
 * Only today's records can be deleted.
 * Historical records must be corrected via PUT — never deleted.
 */
async function deleteRecord(user, params) {
  const { schoolId } = user;
  const { id }       = params;

  // 1) Fetch the record — only delete if it belongs to this school AND is today
  const record = await attendanceRepo.findTodayRecord(id, schoolId);

  if (!record) {
    throw new AppError(
      "Record not found or cannot be deleted. Only today's records can be deleted — use PUT to correct historical records.",
      404
    );
  }

  // 2) Delete history rows first (FK requires this)
  await attendanceRepo.deleteHistoryByAttendance(id);

  // 3) Delete the attendance record
  await attendanceRepo.deleteRecord(id, schoolId);
}

/**
 * GET TODAY'S RECORD — student's own today record, resolved from JWT.
 * No studentId needed in the URL — identity comes from the token.
 */
async function getMyToday(user, query) {
  const { id: userId, schoolId } = user;
  const { shift_type } = query;

  if (shift_type && !VALID_SHIFT_TYPES.includes(shift_type)) {
    throw new AppError(`shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  const student = await attendanceRepo.getStudentByUserId(userId, schoolId);
  if (!student) {
    throw new AppError('No student profile found for your account', 404);
  }

  return await attendanceRepo.getTodayRecord(student.id, schoolId, shift_type);
}

/**
 * GET MY HISTORY — student's own attendance history, resolved from JWT.
 * No studentId needed — identity comes from the token.
 */
async function getMyHistory(user, query) {
  const { id: userId, schoolId } = user;
  const { limit = 14, shift_type } = query;

  const parsedLimit = parseInt(limit, 10);
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 90) {
    throw new AppError('limit must be a number between 1 and 90', 400);
  }

  if (shift_type && !VALID_SHIFT_TYPES.includes(shift_type)) {
    throw new AppError(`shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  const student = await attendanceRepo.getStudentByUserId(userId, schoolId);
  if (!student) {
    throw new AppError('No student profile found for your account', 404);
  }

  return await attendanceRepo.getStudentHistory(student.id, schoolId, {
    shift_type,
    limit: parsedLimit,
  });
}

/**
 * BATCH CLOCK-IN
 * Teacher/admin marks a whole class at once for a given date + shift.
 *
 * Body:
 *   date       — "YYYY-MM-DD"
 *   shift_type — "morning" | "afternoon" | "whole_day"
 *   entries    — [{ student_id, status, late_reason_code?, note? }]
 *
 * Behaviour:
 *   - If a record already exists for that student/date/shift → update status.
 *   - If no record exists → insert a new one (no clock_in time — teacher mark only).
 *   - Writes audit history for every entry.
 */
async function batchClockIn(user, body) {
  const { id: userId, schoolId, role } = user;
  const { date, shift_type, entries } = body;

  // 1) Validate date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('date is required and must be in YYYY-MM-DD format', 400);
  }

  // 2) Validate shift_type
  if (!shift_type || !VALID_SHIFT_TYPES.includes(shift_type)) {
    throw new AppError(`shift_type must be one of: ${VALID_SHIFT_TYPES.join(', ')}`, 400);
  }

  // 3) Validate entries array
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AppError('entries must be a non-empty array', 400);
  }

  for (const entry of entries) {
    if (!entry.student_id) {
      throw new AppError('Each entry must have a student_id', 400);
    }
    if (!entry.status || !VALID_STATUSES.includes(entry.status)) {
      throw new AppError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    // late_reason_code is optional in batch — teacher roll doesn't collect a reason
    if (entry.late_reason_code && !VALID_LATE_REASONS.includes(entry.late_reason_code)) {
      throw new AppError(`late_reason_code must be one of: ${VALID_LATE_REASONS.join(', ')}`, 400);
    }
  }

  const source = resolveSource(role);
  const conn   = await pool.getConnection();

  try {
    await conn.beginTransaction();

    let savedCount = 0;

    for (const entry of entries) {
      // Confirm student belongs to this school
      const student = await attendanceRepo.getStudentById(entry.student_id, schoolId);
      if (!student) {
        throw new AppError(`Student ${entry.student_id} not found in your school`, 404);
      }

      const existing = await attendanceRepo.findRecordForDate(
        student.id, schoolId, date, shift_type, conn,
      );

      if (existing) {
        // Update existing record
        await attendanceRepo.updateStatus(existing.id, schoolId, {
          status:           entry.status,
          late_reason_code: entry.late_reason_code ?? null,
          note:             entry.note             ?? null,
          userId,
        }, conn);

        await attendanceRepo.writeHistory({
          attendanceId:    existing.id,
          previousStatus:  existing.status,
          newStatus:       entry.status,
          changedByUserId: userId,
          source,
        }, conn);
      } else {
        // Insert new record
        const insertId = await attendanceRepo.insertBatchRecord({
          schoolId,
          studentId:       student.id,
          classId:         student.homeroom_class_id,
          userId,
          shift_type,
          date,
          status:          entry.status,
          source,
          late_reason_code: entry.late_reason_code ?? null,
          note:             entry.note             ?? null,
        }, conn);

        await attendanceRepo.writeHistory({
          attendanceId:    insertId,
          previousStatus:  null,
          newStatus:       entry.status,
          changedByUserId: userId,
          source,
        }, conn);
      }

      savedCount += 1;
    }

    await conn.commit();
    return { saved: savedCount };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getClassAttendance(user, params, query)
// Returns all students in a class, each with their attendance status for today.
//
// WHY this exists:
//   This is the teacher's attendance page data source.
//   The teacher logs in, goes to the Attendance tab, and sees THEIR class.
//   Every student in the class appears — marked or not — so the teacher
//   can mark those who haven't been recorded yet.
//
// Who can call this: teacher, admin, principal
// classId comes from the URL: GET /api/attendance/class/1
// schoolId comes from the JWT — the teacher cannot see another school's class
// shift_type is an optional query param: ?shift_type=morning
// ─────────────────────────────────────────────────────────────────────────────
async function getClassAttendance(user, params, query) {
  const { schoolId } = user;

  // classId comes from the URL parameter (:classId)
  const classId   = Number(params.classId);
  const shiftType = query.shift_type || null; // Optional filter: ?shift_type=morning

  // Validate that classId is actually a number (not a string like 'abc')
  if (!classId || isNaN(classId)) {
    throw new AppError('Invalid class ID', 400);
  }

  // Fetch all students in this class + their attendance for today
  const students = await attendanceRepo.getStudentsByClassForToday(classId, schoolId, shiftType);

  return students;
}

module.exports = {
  clockIn,
  clockOut,
  updateAttendance,
  getBySchool,
  getStudentHistory,
  deleteRecord,
  getMyToday,
  getMyHistory,
  batchClockIn,
  getClassAttendance,
};
