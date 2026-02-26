# EduAir API — Backend Developer Guide

> **Audience:** Ray (Lead Developer), AI assistants (Claude, ChatGPT, Gemini), and any future contributor.
> **Scope:** Everything related to the Node.js + Express + MySQL backend for EduAir.
> **Last updated:** February 25, 2026

---

## 0. The EduAir Oath

EduAir is not a hobby project. It is a system built for real Jamaican schools, real students, and real families.

We — the developer, and every AI assistant that contributes to this codebase — are bound by this commitment:

> *"EduAir takes full responsibility for the integrity, security, and privacy of every record stored in this system. Every student's attendance record, every teacher's action, and every school's data belongs to that school alone. We will never allow one school's data to bleed into another. We will never allow an unauthorized user to read, write, or delete a record that does not belong to them. We will never ship code that silently corrupts, exposes, or loses data. If it is not proven working — it does not go in."*

This is the standard. Every function written in this codebase must be held to it.

**Solomon Jones (Project Supervisor) confirmed:**
> *"Multi-tenant support must remain. School-id filtering must be strict and consistent. If implemented cleanly with proper isolation and audit tracking, this becomes one of the strongest projects submitted."*

---

## 1. Project Overview

**EduAir** is a multi-tenant school attendance management system for Jamaican schools.

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Mobile App   | Flutter 3.9.2+ + Riverpod         |
| Realtime/Auth | Firebase Auth + Firestore         |
| Backend API  | Node.js + Express                 |
| Database     | MySQL 8+                          |
| Auth (API)   | JWT (jsonwebtoken + bcryptjs)     |
| Environment  | `.env` via dotenv                 |

**User Roles:** `student`, `teacher`, `parent`, `admin`, `principal`

**Multi-Tenancy:** Every table is scoped by `school_id`. A user can only ever access data that belongs to their school. This is enforced at the API layer via JWT — `school_id` is read from `req.user.schoolId`, never from client input.

---

## 2. Project Structure

```
eduair_api/
├── app.js                     # Express app — routes, middleware, global error handler
├── config/
│   └── db.js                  # MySQL connection pool (promise-based)
├── controllers/
│   ├── authController.js      # register, login
│   ├── schoolController.js    # getAllSchools, getSchoolById, createSchool, updateSchool
│   └── studentController.js   # getAllStudents, getStudentById, createStudent, updateStudent, deleteStudent
├── middleWare/
│   ├── authMiddleWare.js      # JWT verification — sets req.user
│   └── roles.middleWare.js    # Role-based access — requireRole('admin', 'principal')
├── routes/
│   ├── authRoutes.js          # POST /api/auth/login, POST /api/auth/register
│   ├── schoolRoutes.js        # GET/POST /api/schools, GET /api/schools/:id, PUT /api/schools/me
│   └── studentRoutes.js       # GET/POST /api/students, GET/PUT/DELETE /api/students/:id
├── utils/
│   └── AppError.js            # Custom operational error class
├── DB/
│   └── edu_air_db.sql         # Full MySQL schema — source of truth for all table definitions
└── BACKEND.md                 # This file
```

---

## 3. Architecture Rules

### The Golden Rule — Multi-Tenant Isolation

**Every query that touches tenant data must be filtered by `school_id`.**

```js
// ✅ CORRECT — always read school_id from the JWT
const school_id = req.user.schoolId;
const [rows] = await pool.query(
  'SELECT * FROM students WHERE school_id = ?',
  [school_id]
);

// ❌ WRONG — never trust the client for school_id
const school_id = req.body.school_id;   // client can send anything
const school_id = req.params.school_id; // URL can be tampered with
```

**No exceptions. No shortcuts. One breach here exposes one school's data to another school's admin.**

### Request Flow

```
Flutter App / Postman
        │
        ▼
    Express Router
        │
        ▼
  authMiddleWare       ← Verifies JWT, confirms user exists in DB, sets req.user
        │
        ▼
  requireRole(...)     ← Checks req.user.role against allowed roles (optional per route)
        │
        ▼
    Controller         ← Reads req.user.schoolId / req.user.id — never req.body for IDs
        │
        ▼
   MySQL Pool          ← Parameterized queries only — zero string interpolation
        │
        ▼
  JSON Response        ← Never include password_hash, never expose internal errors
```

### Parameterized Queries — Non-Negotiable

```js
// ✅ CORRECT — ? placeholder, value in array
await pool.query('SELECT * FROM schools WHERE id = ?', [school_id]);

// ❌ SQL INJECTION — never do this
await pool.query(`SELECT * FROM schools WHERE id = ${school_id}`);
```

### Error Handling Pattern

```js
// Operational errors — throw AppError with a status code
throw new AppError('School not found', 404);

// Unexpected errors — pass to next(), global handler catches
} catch (err) {
  next(err);
}
```

Global error handler in `app.js` returns:
- `isOperational: true` → sends the real message to client
- `isOperational: false` (crash) → logs server-side, sends generic message to client

---

## 4. Database — Schools Table

> **Source of truth:** `DB/edu_air_db.sql`

```sql
CREATE TABLE schools (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(100)   NOT NULL,
  moey_school_code   VARCHAR(50)    DEFAULT NULL,   -- Ministry of Education code
  short_code         VARCHAR(50)    DEFAULT NULL,   -- Internal short identifier
  parish             VARCHAR(100)   NOT NULL,
  school_type        ENUM('basic','primary','prep','secondary','all_age','heart_nta','other')
                                    NOT NULL DEFAULT 'primary',
  is_shift_school    TINYINT(1)     NOT NULL DEFAULT 0, -- 1 = morning/afternoon shifts
  default_shift_type ENUM('morning','afternoon','whole_day')
                                    NOT NULL DEFAULT 'whole_day',
  latitude           DECIMAL(9,6)   DEFAULT NULL,   -- GPS for geofencing
  longitude          DECIMAL(9,6)   DEFAULT NULL,
  radius_meters      INT            NOT NULL DEFAULT 150,  -- Geofence radius
  timezone           VARCHAR(50)    NOT NULL DEFAULT 'America/Jamaica',
  is_active          TINYINT(1)     NOT NULL DEFAULT 1,
  created_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_school_name_parish  (name, parish),
  UNIQUE KEY uq_schools_moey_code     (moey_school_code),
  UNIQUE KEY uq_schools_short_code    (short_code)
);
```

**Key rules:**
- `name + parish` must be unique — no two "Papine High / Kingston" rows
- `moey_school_code` must be unique — required for MoEYI reporting
- `latitude`, `longitude`, `radius_meters` power the geofencing check in the Flutter app
- Every other table (`users`, `students`, `teachers`, `attendance`) has a `school_id` FK back to this table

---

## 5. Implemented Endpoints

### Auth — `/api/auth`

| Method | Route                  | Auth          | Description |
|--------|------------------------|---------------|-------------|
| POST   | `/api/auth/login`      | Public        | Login with email + password, returns JWT |
| POST   | `/api/auth/register`   | Admin/Principal | Create a new user account for the school |

#### POST `/api/auth/login`

**Request body:**
```json
{
  "email": "admin@papinehigh.edu.jm",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "admin@papinehigh.edu.jm",
    "role": "admin",
    "schoolId": 1
  }
}
```

**Security rules applied:**
- Generic `'Invalid credentials'` for both wrong email and wrong password — never reveals which one failed
- `password_hash` never returned to client
- JWT payload contains `id`, `email`, `role`, `schoolId` — exactly what `authMiddleWare` expects

#### POST `/api/auth/register`

**Protected:** Bearer token required. Role must be `admin` or `principal`.

`school_id` is read from the JWT — an admin can only create users for their own school.

**Request body:**
```json
{
  "email": "student@papinehigh.edu.jm",
  "password": "password123",
  "first_name": "Ray",
  "last_name": "Brown",
  "role": "student"
}
```

---

### Schools — `/api/schools`

| Method | Route               | Auth             | Description |
|--------|---------------------|------------------|-------------|
| GET    | `/api/schools`      | Public           | List all active schools (for school selection dropdown) |
| GET    | `/api/schools/:id`  | Public           | Get one school by id |
| POST   | `/api/schools`      | Open             | Register a new school |
| PUT    | `/api/schools/me`   | Admin/Principal  | Update the logged-in user's own school |

#### Why GET is public

The Flutter app shows a school-selection dropdown during onboarding — before the user has a JWT. These two routes must be public. All other data routes are locked behind auth.

#### GET `/api/schools`

**Response (200):**
```json
{
  "message": "Schools fetched successfully",
  "count": 3,
  "data": [
    {
      "id": 1,
      "name": "Papine High",
      "moey_school_code": null,
      "short_code": null,
      "parish": "Kingston",
      "school_type": "secondary",
      "is_shift_school": 0,
      "default_shift_type": "whole_day",
      "latitude": 18.012345,
      "longitude": -76.78904,
      "radius_meters": 200,
      "timezone": "America/Jamaica",
      "is_active": 1
    }
  ]
}
```

#### POST `/api/schools`

**Required fields:** `name`, `parish`, `school_type`

**Optional fields:** `moey_school_code`, `short_code`, `is_shift_school`, `default_shift_type`, `latitude`, `longitude`, `radius_meters`, `timezone`

**Request body:**
```json
{
  "name": "Papine High",
  "parish": "Kingston",
  "school_type": "secondary",
  "moey_school_code": "MOE-001",
  "is_shift_school": 0,
  "default_shift_type": "whole_day",
  "latitude": 18.012345,
  "longitude": -76.789040,
  "radius_meters": 200
}
```

**Allowed `school_type` values:** `basic`, `primary`, `prep`, `secondary`, `all_age`, `heart_nta`, `other`

**Allowed `default_shift_type` values:** `morning`, `afternoon`, `whole_day`

**Duplicate protection:** If `name + parish` already exists OR `moey_school_code` already exists → `409 Conflict`

#### PUT `/api/schools/me`

**Protected:** Bearer token required. Role must be `admin` or `principal`.

`school_id` is read from `req.user.schoolId` (JWT). An admin **cannot** update another school by passing a different ID — there is no `:id` param on this route.

`user_id` is also read from `req.user.id` — available for future audit trail use.

Sends only the fields you want to change. Any field not sent keeps its current value (`COALESCE` pattern).

**Request body (partial update example):**
```json
{
  "radius_meters": 250,
  "is_shift_school": 1,
  "default_shift_type": "morning"
}
```

---

### Students — `/api/students`

> **Tested:** Feb 25, 2026 — all 5 routes confirmed working in Postman with admin JWT.

| Method | Route | Auth | Role | Description |
|--------|-------|------|------|-------------|
| GET | `/api/students` | Required | admin, principal, teacher | List all active students in the school |
| GET | `/api/students/:id` | Required | admin, principal, teacher | Get one student by id |
| POST | `/api/students` | Required | admin, principal | Enrol a new student (creates user + student row) |
| PUT | `/api/students/:id` | Required | admin, principal | Update student profile |
| DELETE | `/api/students/:id` | Required | admin, principal | Soft deactivate student (status = inactive) |

**Key design decisions:**
- `school_id` always comes from `req.user.schoolId` — never from request body
- Grade info comes from `LEFT JOIN classes` on `homeroom_class_id` — no `grade` column on `students`
- DELETE is a **soft delete** — sets `status = 'inactive'`, preserves attendance history and FK integrity
- Creating a student creates **two rows**: one in `users` (login account) and one in `students` (profile)
- `first_name` and `last_name` stored in both `users` and `students` (both tables require them NOT NULL)

#### GET `/api/students`

**Response (200):**
```json
{
  "message": "Students fetched successfully",
  "count": 3,
  "data": [
    {
      "student_id": 2,
      "user_id": 2,
      "email": "shanice.davis@student.jm",
      "first_name": "Shanice",
      "last_name": "Davis",
      "student_code": null,
      "sex": null,
      "date_of_birth": null,
      "current_shift_type": "whole_day",
      "phone_number": null,
      "status": "active",
      "homeroom_class_id": 2,
      "class_name": "Grade 9 Red",
      "grade_level": "Grade 9"
    }
  ]
}
```

#### POST `/api/students`

**Required fields:** `email`, `password`, `first_name`, `last_name`

**Optional fields:** `student_code`, `sex`, `date_of_birth`, `current_shift_type`, `phone_number`, `homeroom_class_id`

**Validations:**
- Email format checked with regex
- Password minimum 8 characters
- `sex` must be `male` or `female`
- `current_shift_type` must be `morning`, `afternoon`, or `whole_day`
- Duplicate email returns `409 Conflict`

**Request body:**
```json
{
  "email": "john.smith@student.jm",
  "password": "Password123",
  "first_name": "John",
  "last_name": "Smith",
  "student_code": "STU-2026-001",
  "sex": "male",
  "current_shift_type": "whole_day",
  "phone_number": "8761234567",
  "homeroom_class_id": 1
}
```

**Response (201):**
```json
{
  "message": "Student enrolled successfully",
  "data": {
    "student_id": 11,
    "user_id": 8,
    "email": "john.smith@student.jm",
    "first_name": "John",
    "last_name": "Smith",
    "student_code": "STU-2026-001",
    "sex": "male",
    "date_of_birth": null,
    "current_shift_type": "whole_day",
    "phone_number": "8761234567",
    "status": "active",
    "homeroom_class_id": 1,
    "class_name": "10A",
    "grade_level": "Grade 10"
  }
}
```

#### PUT `/api/students/:id`

Send only the fields you want to change. Any field not sent keeps its current value (`COALESCE` pattern).

**Request body (partial update):**
```json
{
  "phone_number": "8769999999",
  "current_shift_type": "morning"
}
```

#### DELETE `/api/students/:id`

**Response (200):**
```json
{ "message": "Student deactivated successfully" }
```

Student is now hidden from `GET /api/students` (filtered by `status = 'active'`). Attendance records are preserved.

---

## 6. Middleware

### `authMiddleWare.js`

Runs on every protected route. Steps:
1. Read `Authorization` header
2. Confirm it starts with `Bearer `
3. Extract and verify JWT against `process.env.JWT_SECRET`
4. Hit the DB to confirm the user still exists (catches deleted accounts)
5. Set `req.user = { id, email, role, schoolId }`

**After this middleware runs, `req.user` is trusted.** Every controller reads IDs from here.

### `roles.middleWare.js`

```js
// Usage
router.put('/me', requireRole('admin', 'principal'), schoolController.updateSchool);
```

Returns `403 Forbidden` if the user's role is not in the allowed list.

---

## 7. Shared Patterns in Controllers

### `SCHOOL_FIELDS` constant

The SELECT column list is defined once at the top of `schoolController.js`:

```js
const SCHOOL_FIELDS = `
  id, name, moey_school_code, short_code, parish, school_type,
  is_shift_school, default_shift_type,
  latitude, longitude, radius_meters, timezone, is_active
`;
```

Every SELECT uses this. If a column is added or removed from the API response, change it here once.

### `_getSchool(id)` helper

Used after INSERT and UPDATE to return the freshly saved record. Never return `result.insertId` data directly — always re-fetch from DB to confirm what was actually written.

### `_validateSchoolFields()` helper

Called by both `createSchool` and `updateSchool`. Single source of truth for enum validation.

### `_handleDupEntry()` helper

Called in both `createSchool` and `updateSchool` catch blocks. If `ER_DUP_ENTRY` — returns `409`. Otherwise passes to global error handler.

### `_getStudent(studentId, schoolId)` helper — `studentController.js`

Same pattern as `_getSchool`. Used after INSERT and UPDATE to return the full student record with class info joined in. Always includes `LEFT JOIN classes` so students without a class assignment still return correctly.

```js
async function _getStudent(studentId, schoolId) {
  const [rows] = await pool.query(
    `SELECT s.id AS student_id, u.id AS user_id, u.email,
            u.first_name, u.last_name, s.student_code, s.sex,
            s.date_of_birth, s.current_shift_type, s.phone_number,
            s.status, s.homeroom_class_id,
            c.name AS class_name, c.grade_level
     FROM students s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN classes c ON s.homeroom_class_id = c.id
     WHERE s.id = ? AND s.school_id = ?
     LIMIT 1`,
    [studentId, schoolId]
  );
  return rows[0] ?? null;
}
```

---

## 8. Progress Tracker

| # | Feature | Route prefix | Status | Tested |
|---|---------|-------------|--------|--------|
| 1 | Auth (login + register) | `/api/auth` | ✅ Done | ✅ Postman |
| 2 | Schools CRUD | `/api/schools` | ✅ Done | ✅ Postman |
| 3 | Students CRUD | `/api/students` | ✅ Done | ✅ Postman |
| 4 | Attendance clock-in/out | `/api/attendance` | 🔲 Next | — |
| 5 | Attendance history | `/api/attendance/history` | 🔲 Pending | — |
| 6 | Classes | `/api/classes` | 🔲 Pending | — |
| 7 | Reports | `/api/reports` | 🔲 Pending | — |

**For every new controller, the same rules apply:**
- `school_id` from `req.user.schoolId` — never from the client
- Parameterized queries only
- `AppError` for operational errors, `next(err)` for everything else
- No `password_hash`, no internal stack traces in responses

---

## 9. Environment Variables

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=edu_air_db
JWT_SECRET=a_long_random_secret_string
JWT_EXPIRES_IN=7d
PORT=3500
```

---

## 10. Quick Reference — What We Swore To

| Rule | Why |
|------|-----|
| `school_id` always from JWT | Prevents cross-school data access |
| Parameterized queries always | Prevents SQL injection |
| `password_hash` never in response | Protects user credentials |
| Generic auth error messages | Prevents email enumeration |
| `affectedRows` check on UPDATE | Confirms write actually happened |
| `_getSchool()` re-fetch after write | Returns what DB actually saved, not what we sent |
| `isOperational` flag on errors | Prevents internal stack traces reaching the client |
| `is_active` filter on school list | Only active schools shown in the app |

---

*Every line of this backend was written and reviewed by Ray + Claude (Anthropic). ChatGPT and Gemini contributions are reviewed and corrected before they enter the codebase. The oath stands.*
