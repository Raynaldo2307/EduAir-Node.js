# EduAir API

A multi-tenant school management REST API built with Node.js and Express. Designed to power the EduAir mobile app — handling authentication, student enrolment, staff management, class organisation, and attendance tracking across multiple schools.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | MySQL 8 (via mysql2 connection pool) |
| Authentication | JSON Web Tokens (jsonwebtoken) |
| Password hashing | bcryptjs |
| Email | Nodemailer + Mailtrap |
| Environment | dotenv |
| CORS | cors |
| Dev server | nodemon |

---

## Project Structure

```
eduair_api/
├── app.js                        # Entry point — server, middleware, route mounting
├── config/
│   └── db.js                     # MySQL connection pool
├── src/
│   ├── features/
│   │   ├── auth/                 # Login, register, profile, password reset
│   │   ├── schools/              # School registration and management
│   │   ├── students/             # Student enrolment and profiles
│   │   ├── staff/                # Staff (teacher) management
│   │   ├── attendance/           # Clock-in, batch marking, history
│   │   └── classes/              # Class list for dropdowns
│   └── middleware/
│       ├── auth.middleware.js    # JWT verification
│       └── role.middleware.js    # Role-based access control
├── utils/
│   ├── AppError.js               # Operational error class
│   └── email.js                  # Nodemailer email helper
├── DB/
│   └── edu_air_db.sql            # Database schema
├── .env.example                  # Environment variable template
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- MySQL 8+

### Installation

```bash
git clone https://github.com/your-username/eduair_api.git
cd eduair_api
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `yourpassword` |
| `DB_NAME` | Database name | `edu_air_db` |
| `PORT` | Server port | `3500` |
| `JWT_SECRET` | Secret key for signing tokens | `a-long-random-string` |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `MAILTRAP_HOST` | Mailtrap SMTP host | `sandbox.smtp.mailtrap.io` |
| `MAILTRAP_PORT` | Mailtrap SMTP port | `2525` |
| `MAILTRAP_USER` | Mailtrap username | `your-mailtrap-user` |
| `MAILTRAP_PASS` | Mailtrap password | `your-mailtrap-pass` |

### Database Setup

Import the schema into MySQL:

```bash
mysql -u root -p < DB/edu_air_db.sql
```

### Running the Server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:3500` by default.

---

## User Roles

The API enforces four roles. Every token carries the user's role, and every protected route checks it.

| Role | Description |
|---|---|
| `admin` | Full access — manages school, staff, students, and all data |
| `principal` | Same as admin — school leadership level access |
| `teacher` | Read access to students and staff; marks and manages attendance |
| `student` | Read-only access to their own attendance records |

---

## API Endpoints

All protected routes require the header:
```
Authorization: Bearer <token>
```

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Public | — | Login with email and password, returns JWT |
| `POST` | `/api/auth/register` | Required | admin, principal | Create a new user account |
| `GET` | `/api/auth/me` | Required | Any | Get current logged-in user profile |
| `PUT` | `/api/auth/me` | Required | Any | Update own profile |
| `POST` | `/api/auth/forgot-password` | Public | — | Request a password reset code via email |
| `POST` | `/api/auth/reset-password` | Public | — | Verify reset code and set new password |

---

### Schools — `/api/schools`

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/schools` | Public | — | List all active schools |
| `GET` | `/api/schools/:id` | Public | — | Get a single school by ID |
| `POST` | `/api/schools` | Public | — | Register a new school |
| `PUT` | `/api/schools/me` | Required | admin, principal | Update own school details |

---

### Students — `/api/students`

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/students` | Required | admin, principal, teacher | List all students in the school |
| `GET` | `/api/students/:id` | Required | admin, principal, teacher | Get a student by ID |
| `POST` | `/api/students` | Required | admin, principal | Enrol a new student |
| `PUT` | `/api/students/:id` | Required | admin, principal | Update student profile |
| `DELETE` | `/api/students/:id` | Required | admin, principal | Deactivate a student (soft delete) |

---

### Staff — `/api/staff`

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/staff` | Required | admin, principal | List all active staff |
| `GET` | `/api/staff/:id` | Required | admin, principal, teacher | Get a staff member by ID |
| `POST` | `/api/staff` | Required | admin, principal | Add a new staff member |
| `PUT` | `/api/staff/:id` | Required | admin, principal | Update staff details |
| `DELETE` | `/api/staff/:id` | Required | admin, principal | Deactivate staff member (soft delete) |

---

### Attendance — `/api/attendance`

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/api/attendance/clock-in` | Required | All | Student self clock-in, or staff marks a student |
| `POST` | `/api/attendance/batch` | Required | teacher, admin, principal | Mark a whole class in one request |
| `GET` | `/api/attendance` | Required | teacher, admin, principal | All school attendance for a given date (`?date=YYYY-MM-DD&shift_type=morning&class_id=1`) |
| `GET` | `/api/attendance/today` | Required | student | Student's own attendance record for today |
| `GET` | `/api/attendance/me` | Required | student | Student's own attendance history (`?limit=14&shift_type=morning`) |
| `GET` | `/api/attendance/class/:classId` | Required | teacher, admin, principal | All students in a class + today's attendance status (`?shift_type=morning`) |
| `GET` | `/api/attendance/student/:studentId` | Required | All | Attendance history for a specific student (`?limit=14&shift_type=morning`) |
| `PUT` | `/api/attendance/:id/clock-out` | Required | All | Record clock-out time |
| `PUT` | `/api/attendance/:id` | Required | teacher, admin, principal | Correct status, add note, update late reason |
| `DELETE` | `/api/attendance/:id` | Required | admin, principal | Delete a record (today's records only) |

---

### Classes — `/api/classes`

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/classes` | Required | admin, principal, teacher | List all classes (used for dropdown menus) |

---

## Security

### Authentication Flow

1. Client sends `POST /api/auth/login` with email and password.
2. Server verifies the password against the bcrypt hash stored in the database.
3. On success, a signed JWT is returned containing `{ id, email, role, schoolId }`.
4. Client includes the token in the `Authorization: Bearer <token>` header on every subsequent request.

### JWT Verification (auth.middleware.js)

Every protected route runs through `authMiddleware`, which:
1. Checks the `Authorization` header is present and formatted correctly.
2. Verifies the token signature using `JWT_SECRET`.
3. Queries the database to confirm the user still exists (catches deleted accounts with live tokens).
4. Attaches `req.user = { id, email, role, schoolId }` for downstream use.

### Role Enforcement (role.middleware.js)

`requireRole(...roles)` runs after `authMiddleware` and rejects any request where `req.user.role` is not in the allowed list, returning `403 Forbidden`.

### Password Security

- Passwords are hashed with **bcryptjs** (salt rounds: 10) before storage — plain text passwords are never written to the database.
- Login responses return the same error message whether the email is wrong or the password is wrong — preventing user enumeration.

### Error Handling

Errors are split into two types:
- **Operational errors** (`AppError`) — expected failures (wrong password, not found, forbidden). The real message is sent to the client.
- **Programming errors** — unexpected crashes. A generic `"Something went wrong"` message is sent to the client; the full error is logged server-side only.

---

## Environment Variables Template

An `.env.example` file is included in the repository. **Never commit your `.env` file** — it is listed in `.gitignore`.

---

## License

This project is proprietary and private. All rights reserved.
No part of this codebase may be copied, modified, distributed, or used without explicit written permission from the author.
