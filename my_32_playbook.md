# EduAir — 32-Day Capstone Playbook
**Start:** February 23, 2026
**Due:** March 27, 2026 (Friday)
**Viva:** Week of March 30, 2026
**Student:** Solo

---

> **Node.js reminder — combining DATE + TIME from MySQL:**
> ```js
> // attendance_date is DATE, clock_in is TIME — combine them in your API response
> const clockInAt = new Date(`${attendance_date}T${clock_in}`);
> const clockOutAt = new Date(`${attendance_date}T${clock_out}`);
> ```

---

## Project Overview

**EduAir** — Multi-tenant school attendance management app for Jamaican schools.

**Full Stack:**
- Frontend: Flutter + Riverpod
- Auth + Realtime: Firebase (Auth, Firestore)
- Backend API: Node.js + Express
- Database: MySQL (designed — scripts pending)

**Capstone Domain:** Education

---

## What Is Already Done (Firebase/Flutter)

- [x] Firebase Authentication (all 5 roles)
- [x] Multi-school support (schoolId scoping)
- [x] Student attendance — clock in/out with geofencing
- [x] Jamaica shift system (morning / afternoon / whole_day)
- [x] MoEYI late reason categories
- [x] Teacher attendance flow
- [x] Admin student management (view + edit)
- [x] Layered architecture (UI → Controller → Service → Repository → Firestore)
- [x] Riverpod state management
- [x] Typed domain exceptions + error mapping

---

## MySQL Tables — Progress

All 10 tables designed. Next step: write and run CREATE TABLE SQL scripts.

- [x] `schools` — id, name, parish, school_type, moey_school_code, is_shift_school, default_shift_type, lat, lng, radius_meters, timezone, is_active, timestamps
- [x] `users` — id, email, password_hash, first_name, last_name, role, school_id, timestamps
- [x] `students` — id, school_id, user_id, first_name, last_name, student_code, sex, date_of_birth, current_shift_type, phone_number, homeroom_class_id, status, timestamps
- [x] `teachers` — id, school_id, user_id, staff_code, department, employment_type, hire_date, current_shift_type, homeroom_class_id, status, timestamps
- [x] `classes` — id, school_id, name, grade_level, timestamps
- [x] `student_classes` — id, student_id, class_id (many-to-many)
- [x] `teacher_classes` — id, teacher_id, class_id (many-to-many)
- [x] `parent_students` — id, parent_user_id, student_id, relationship_type, is_primary_guardian
- [x] `attendance` — id, school_id, student_id, class_id, attendance_date, shift_type, status, source, clock_in, clock_in_lat/lng, clock_out, clock_out_lat/lng, late_reason_code, device_id, recorded_by_user_id, note, timestamps
- [x] `attendance_history` — id, attendance_id, previous_status, new_status, changed_by_user_id, source, created_at
- [ ] Write all CREATE TABLE SQL scripts in correct order
- [ ] Run scripts in MySQL — zero errors
- [ ] Insert test data (2 schools, 3 students, 3 attendance rows)

---

## Deliverables Checklist

- [ ] Functional Flutter app (APK or runnable)
- [ ] Node/Express + MySQL backend running
- [ ] GitHub repository (clean, pushed)
- [ ] Technical documentation (architecture, API endpoints, DB schema)
- [ ] User manual with screenshots
- [ ] Application screenshots
- [ ] 5-minute demo video
- [ ] Project brief / problem statement

---

## The 32-Day Plan

---

### PHASE 1 — MySQL Database Design ✅ COMPLETE
> Started week of Feb 16. All 10 tables designed and documented.
> Remaining: write SQL scripts and test in MySQL.

---

#### Day 1 — Feb 23 ✅
**All 10 tables designed** — schools, users, students, teachers, classes, student_classes, teacher_classes, parent_students, attendance, attendance_history

---

#### Days 2–6 — Feb 24–28
**Focus: Write and test CREATE TABLE SQL scripts**
- [ ] Create `edu_air_db.sql` — all 10 CREATE TABLE statements in correct order
- [ ] Order matters: `schools` → `users` → `classes` → `students` → `teachers` → `student_classes` → `teacher_classes` → `parent_students` → `attendance` → `attendance_history`
- [ ] Run scripts in MySQL (TablePlus / DBeaver / MySQL Workbench)
- [ ] Fix any errors until all 10 tables create with zero issues
- [ ] Insert test data: 2 schools, 3 students, 3 attendance rows
- [ ] Test foreign key enforcement (insert a student with a bad school_id — it must fail)

---

#### Day 7 — Mar 1
**Focus: Schema review + diagram**
- [ ] Draw the relationship diagram on dbdiagram.io or paper
- [ ] Confirm every table has `created_at` + `updated_at` where appropriate
- [ ] Save `edu_air_db.sql` to the `/backend` folder — this is a deliverable

---

### PHASE 2 — Node.js + Express Backend
> Goal: A working API that the Flutter app (or Postman) can call. Cover auth, students, and attendance.

---

#### Day 8 — Mar 2
**Focus: Node project setup**
- [ ] Create `/backend` folder inside the EduAir project
- [ ] Run `npm init -y`
- [ ] Install: `express`, `mysql2`, `dotenv`, `bcryptjs`, `jsonwebtoken`, `cors`
- [ ] Create folder structure:
  ```
  backend/
  ├── routes/
  ├── controllers/
  ├── middleware/
  ├── config/
  └── server.js
  ```
- [ ] Create `server.js` — basic Express app running on port 3000
- [ ] Create `.env` — DB_HOST, DB_USER, DB_PASS, DB_NAME, JWT_SECRET
- [ ] Test: `node server.js` — server starts with no errors

---

#### Day 9 — Mar 3
**Focus: MySQL connection**
- [ ] Create `config/db.js` — MySQL connection pool using `mysql2`
- [ ] Test connection: query `SELECT 1` and log success
- [ ] Handle connection errors gracefully

---

#### Day 10 — Mar 4
**Focus: Auth routes — Register + Login**
- [ ] Create `routes/auth.routes.js`
- [ ] Create `controllers/auth.controller.js`
- [ ] POST `/api/auth/register` — hash password with bcryptjs, insert into users table, return JWT
- [ ] POST `/api/auth/login` — verify password, return JWT
- [ ] Test both routes in Postman

---

#### Day 11 — Mar 5
**Focus: Auth middleware + protected routes**
- [ ] Create `middleware/auth.middleware.js` — verify JWT from Authorization header
- [ ] Create `middleware/role.middleware.js` — check user role (admin, teacher, student)
- [ ] Test: call a protected route without token — should return 401
- [ ] Test: call with valid token — should pass through

---

#### Day 12 — Mar 6
**Focus: Schools routes**
- [ ] Create `routes/schools.routes.js`
- [ ] Create `controllers/schools.controller.js`
- [ ] GET `/api/schools` — list all schools
- [ ] GET `/api/schools/:id` — get one school
- [ ] POST `/api/schools` — create school (admin only)
- [ ] PUT `/api/schools/:id` — update school (admin only)
- [ ] Test all 4 in Postman

---

#### Day 13 — Mar 7
**Focus: Students routes — Read + Create**
- [ ] Create `routes/students.routes.js`
- [ ] Create `controllers/students.controller.js`
- [ ] GET `/api/schools/:schoolId/students` — list students for a school
- [ ] GET `/api/students/:id` — get one student
- [ ] POST `/api/students` — create student (admin only)
- [ ] Test in Postman

---

#### Day 14 — Mar 8
**Focus: Students routes — Update + Delete**
- [ ] PUT `/api/students/:id` — update student info
- [ ] DELETE `/api/students/:id` — soft delete (set status = 'inactive')
- [ ] This completes full CRUD for students
- [ ] Test all operations in Postman
- [ ] This is your CRUD demonstration for the capstone — make sure it works cleanly

---

#### Day 15 — Mar 9
**Focus: Attendance routes — Create + Read**
- [ ] Create `routes/attendance.routes.js`
- [ ] Create `controllers/attendance.controller.js`
- [ ] POST `/api/attendance/clock-in` — create attendance record
- [ ] GET `/api/attendance?school_id=&date=&shift_type=` — get records for a school/date/shift
- [ ] GET `/api/attendance/student/:studentId` — get student's recent records
- [ ] Test in Postman

---

#### Day 16 — Mar 10
**Focus: Attendance routes — Update + polish**
- [ ] PUT `/api/attendance/:id` — update record (clock out, update status)
- [ ] DELETE `/api/attendance/:id` — admin only, with confirmation logic
- [ ] Add input validation to all routes (check required fields, return 400 if missing)
- [ ] Add global error handler middleware to `server.js`
- [ ] Backend is now feature-complete — run full Postman test of all routes

---

### PHASE 3 — Connect Flutter to Node Backend
> Goal: Flutter calls at least one real Node API endpoint. Shows full-stack integration.

---

#### Day 17 — Mar 11
**Focus: HTTP service in Flutter**
- [ ] Add `dio` package to Flutter pubspec.yaml
- [ ] Create `lib/src/services/api_service.dart` — base Dio client with base URL + JWT header
- [ ] Create `lib/src/services/auth_api_service.dart` — login/register via Node API
- [ ] Store JWT token in Flutter (use SharedPreferences or flutter_secure_storage)

---

#### Day 18 — Mar 12
**Focus: Connect student listing to Node API**
- [ ] Create `lib/src/services/students_api_service.dart`
- [ ] Wire up admin student list page to call Node API instead of / in addition to Firestore
- [ ] Handle loading state, empty state, error state properly

---

#### Day 19 — Mar 13
**Focus: Connect attendance to Node API**
- [ ] Create `lib/src/services/attendance_api_service.dart`
- [ ] Wire up at least one attendance read operation to Node API
- [ ] Keep Firebase for realtime / auth — Node handles reports/analytics

---

#### Day 20 — Mar 14
**Focus: Test full flow end-to-end**
- [ ] Flutter → Node API → MySQL → response back to Flutter
- [ ] Fix any CORS issues on the backend
- [ ] Fix any auth token issues
- [ ] Verify the full flow works on a real device or emulator

---

#### Day 21 — Mar 15
**Focus: Polish + error handling**
- [ ] Every API call in Flutter must handle: loading, success, error
- [ ] No raw error messages shown to user — use friendly messages
- [ ] Test offline behaviour — what happens when API is unreachable?

---

### PHASE 4 — Flutter App Completion
> Goal: All screens working, all CRUD visible, UI polished.

---

#### Day 22 — Mar 16
**Focus: Complete any unfinished screens**
- [ ] Identify every screen that is incomplete or placeholder
- [ ] List them and prioritize
- [ ] Start with the ones assessors will see first (auth flow, dashboard, attendance)

---

#### Day 23 — Mar 17
**Focus: CRUD completeness check**
- [ ] Create — works and shows success feedback
- [ ] Read — works with loading indicator + empty state
- [ ] Update — works with confirmation
- [ ] Delete — works with confirmation dialog before deleting
- [ ] Every CRUD operation must be visible in the UI — this is an assessment criterion

---

#### Day 24 — Mar 18
**Focus: UI polish**
- [ ] Consistent color system throughout the app
- [ ] Typography hierarchy (headings vs body vs captions)
- [ ] Consistent spacing and padding
- [ ] Every screen has a proper AppBar or navigation
- [ ] No placeholder/Lorem ipsum text anywhere

---

#### Day 25 — Mar 19
**Focus: Final Flutter testing**
- [ ] Run on real device
- [ ] Test every user role (student, teacher, admin)
- [ ] Test the full attendance flow (clock in → see record → clock out)
- [ ] Fix any crashes or broken states
- [ ] Build APK: `flutter build apk`

---

### PHASE 5 — Deliverables
> Goal: Everything submitted on time. Nothing left to chance.

---

#### Day 26 — Mar 20
**Focus: GitHub repository**
- [ ] Clean up the repo — remove debug prints, dead code, test files
- [ ] Write a proper `README.md` (project name, description, setup instructions, tech stack)
- [ ] Push all code — Flutter app + `/backend` Node server
- [ ] Make sure the repo is public or accessible to assessors

---

#### Day 27 — Mar 21
**Focus: Technical documentation**
- [ ] Architecture overview (1 page — describe the 3 layers: Flutter, Firebase, Node/MySQL)
- [ ] API endpoints table (method, route, description, auth required)
- [ ] Database schema diagram (screenshot from dbdiagram.io or TablePlus)
- [ ] Packages and services used (list with brief reason for each)

---

#### Day 28 — Mar 22
**Focus: User manual**
- [ ] Take screenshots of every key screen
- [ ] Write step-by-step instructions for: register, log in, clock in, view attendance, admin add student
- [ ] Export as PDF

---

#### Day 29 — Mar 23
**Focus: Project brief / problem statement**
- [ ] 1 page: What problem does EduAir solve?
- [ ] Who are the target users? (students, teachers, admins at Jamaican schools)
- [ ] What is your solution?
- [ ] Keep it professional — this is the first thing assessors read

---

#### Day 30 — Mar 24
**Focus: 5-minute demo video**
- [ ] Record screen + audio (use QuickTime or OBS)
- [ ] Script: App overview (30s) → Auth flow (45s) → Key features (90s) → CRUD demo (90s) → Backend/API (45s)
- [ ] Keep it under 5 minutes
- [ ] Export and upload to Google Drive or YouTube (unlisted)

---

#### Day 31 — Mar 25
**Focus: Review everything**
- [ ] Read through all deliverables — is anything missing?
- [ ] Do a final run-through of the app on device
- [ ] Check the APK installs and runs cleanly
- [ ] Make sure GitHub link works

---

#### Day 32 — Mar 26
**Focus: Submit**
- [ ] Final submission
- [ ] Double-check everything is uploaded/linked
- [ ] Breathe — you made it

---

## Viva Prep (Mar 27 onwards)

Be ready to answer these without hesitation:

1. **"Describe your app architecture and why you structured it that way."**
   > EduAir uses a feature-first layered architecture: UI → Controller → Service → Repository → Firestore/API. Business logic never lives in the UI.

2. **"Why did you choose Riverpod for state management?"**
   > Riverpod eliminates context dependency issues, is compile-safe, and scales well for multi-role apps. Better than Provider for this complexity level.

3. **"How does your authentication work?"**
   > Firebase Auth handles identity and sessions. On login, user role and schoolId are loaded from Firestore. The Node API uses JWT for its own protected routes.

4. **"How does your app separate user data?"**
   > All data is scoped by schoolId. Users can only access data for their school. Role checks happen at the controller level.

5. **"Where is your business logic located?"**
   > In the `domain/` layer — service classes. Never in the UI. The UI calls controllers, controllers call services, services talk to repositories.

6. **"Walk me through your database design."**
   > 10 tables: schools, users, students, teachers, classes, student_classes, teacher_classes, parent_students, attendance, attendance_history. Fully normalized, foreign keys enforced, indexed for the most common queries. Multi-tenant — every table scoped by school_id.

7. **"Why did you design your attendance table with a unique key on (school_id, student_id, attendance_date, shift_type)?"**
   > To enforce idempotency — a student cannot have two attendance records for the same shift on the same day in the same school. Data integrity enforced at the database level, not just the app level.

8. **"What is the `source` field on your attendance table?"**
   > It tracks how the record was created — `studentSelf` (student clocked in via app), `teacherBatch` (teacher marked the class), or `adminEdit` (admin corrected a record). This is for audit and anti-fraud purposes, and it mirrors the AttendanceSource enum in the Flutter app.

9. **"Why do you have an attendance_history table?"**
   > It's an append-only audit trail. Every time a teacher or admin changes an attendance status, we insert a new row recording the old status, new status, who changed it, and when. We never update or delete history rows — that's the rule.

---

## Bonus Features (if time allows — high scoring)

- [ ] Dark/Light theme toggle
- [ ] Search and filtering on student list
- [ ] Attendance report export (PDF/CSV)
- [ ] Push notifications (FCM)
- [ ] Role-based access visible in UI

---

*Last updated: February 23, 2026 — Phase 1 complete, all 10 tables designed*




 ---                                                                                                                 
  When you're back — here's the plan:                                                                                 
                                                                                                                      
  We go line by line through the auth system:                                                                         
                                                                                                                      
  1. Register     — how a user is created                                                                             
  2. Login        — how JWT is issued                                                                                 
  3. authMiddleware — the doorman at every route
  4. Role checks  — student vs teacher vs admin
  5. Flutter side — how token is stored and sent

  By the end you'll be able to explain every line to your examiner without hesitation.

  ---
  I'll have a study playbook ready when you return.

  Go rest. Clear your head. Come back sharp.

  God bless. See you soon.

● How is Claude doing this session? (optional)
  1: Bad    2: Fine   3: Good   0: Dismiss
                                              
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯  