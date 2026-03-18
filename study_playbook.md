# EduAir Auth Study Playbook
> Personal study guide. Built from real sessions. Updated as you improve.

---

## Your Strengths (confirmed)
- You understand WHY bcrypt is used (not just what it does)
- You know schoolId comes from JWT not request body (multi-tenancy)
- You understand parameterized queries prevent SQL injection
- After being pushed, you explained Step 7 correctly
- You asked the right follow-up question about Uber — that's engineering thinking

---

## Your Weaknesses (be honest with yourself)

### Weakness 1 — Mixing up which step does what
You confused Step 7 (DB user check) with Steps 1-3 (JWT presence check).
These are different jobs. Keep them separate.

FIX: Before your viva, say out loud what each step does from memory.
Steps 1-3 = "Is there a token and is it formatted right?"
Step 5     = "Is the signature valid and not expired?"
Step 7     = "Does this user still exist in the DB right now?"

### Weakness 2 — Saying the opposite of what you mean
You said "if user is deleted they CAN access data" — meant CANNOT.
In a viva, examiners mark on what you say, not what you mean.

FIX: Slow down. Say one sentence. Check it before moving on.

### Weakness 3 — Vague answers under pressure
"No limit and parse" is not a technical answer.
Cost = "one extra DB query per protected request — bottleneck at scale"

FIX: For every concept, memorize: WHAT it is, WHY it exists, WHAT it costs.

---

## Auth System — What You Must Own

### The 9 Steps of authMiddleware (in order)
1. Check Authorization header exists
2. Check it starts with "Bearer "
3. Extract token after the space
4. Check JWT_SECRET is set on server
5. jwt.verify() — signature valid + not expired
6. Extract user ID from decoded token
7. Query DB — does this user still exist?
8. Attach req.user = { id, email, role, schoolId }
9. Call next() — let the request through

### Login Flow (authService.login)
1. Check email + password present
2. Query DB for email
3. If not found → "Invalid credentials" (same message as wrong password — enumeration prevention)
4. bcrypt.compare(password, hash)
5. jwt.sign({ id, email, role, schoolId }, secret, { expiresIn })
6. Return token + user (no password_hash)

### Register Flow (authService.register)
1. Admin must be authenticated (authMiddleware ran)

2. Admin must be admin/principal (requireRole ran)

3. schoolId comes from req.user.schoolId (JWT) — never from body
"We use req.user.schoolId instead of req.body.school_id because we never trust data  from the client. The JWT is signed
   by the server — it cannot be faked. This ensures an admin from School A can    never create users inside School B. Each
  admin can only create users within their own school."

4. Validate fields, email format, password length, role allowed
5. Check email not already in DB
6. bcrypt.hash(password, 10)
7. INSERT INTO users
8. Return user WITHOUT password_hash

### requireRole — How it works
- Factory function: requireRole('admin', 'principal') returns a middleware
- Checks req.user exists (authMiddleware ran first)
- Checks req.user.role is in the allowed list
- If not → 403 Forbidden
- If yes → next()

---

## Your Gaps — Security the App is Missing

| Gap | What's Missing | Risk |
|-----|---------------|------|
| 1 | No rate limiting on /login | Brute force attacks |
| 2 | No refresh tokens | Token expires = forced logout, no smooth session |
| 3 | Logout only deletes local token | Stolen token still works until expiry |
| 4 | HTTP not HTTPS | Passwords and tokens sent in plaintext |
| 5 | DB hit on every request | Bottleneck at scale |
| 6 | JWT_SECRET strength unknown | Weak secret = crackable tokens |
| 7 | No account lockout | Unlimited login attempts |

---

## How Uber/Google Fix It

### Short-lived tokens + refresh tokens
- Access token: 15 minutes. jwt.verify() only — no DB hit.
- Refresh token: 30 days. Stored in DB. Used only to get new access token.
- Logout: delete refresh token from DB. Access token dies in max 15 min.

### Redis cache
- Instead of MySQL on every request, cache user in Redis (memory, microseconds)
- redis.get('user:123') → found → skip DB
- redis.get('user:123') → miss → query DB, store in Redis for 5 min

### Token blacklist (for logout)
- On logout, add token ID (jti) to Redis blacklist
- authMiddleware checks blacklist before allowing request
- Stolen token → blacklisted immediately → access denied

---

## What is Redis?
See bottom of this file.

---

## Session Log

### Session 5 — March 12, 2026
Topic: Flutter app architecture — 5 layers, the chain, the why

WHAT YOU GOT RIGHT:
- Named all 5 layers correctly: data, domain, application, presentation, widgets ✅
- Data layer = talks to external systems (Firestore + Node API) ✅
- Domain layer = business logic only ✅
- Application = Riverpod controllers, sit between UI and services ✅
- Presentation = UI, only calls controllers ✅
- Widgets = reusable UI components within a feature ✅
- The chain: UI → Controller → Service → Repository → Firestore/Node API ✅
- The WHY: if we swap Firestore, only the data layer changes ✅
- Final answer: 9/10 — best answer of any session so far
- Wrote the answer in a physical notebook — good habit, keep doing it

WHAT YOU STRUGGLED WITH:
1. First attempt described what the APP DOES, not the architecture — different question
2. Called MySQL "the backend" — MySQL is the database, Node.js is the backend
3. Needed prompting to include the chain (UI → Controller → Service → Repository)
4. Language loose in middle answers — tightened by the end

PATTERN: Concepts land when pushed layer by layer. Full synthesis takes 2-3 attempts.
IMPROVEMENT: Final answer was clean and unprompted. Progress is real.

LOCKED ANSWER — App Architecture:
"EduAir uses a 5-layer feature-first architecture. Every feature has data, domain, application, presentation, and widgets. The data layer talks to external systems — Firestore and the Node API. The domain layer holds all business logic. The application layer holds Riverpod controllers that sit between the UI and the services. The presentation layer is the UI — it only calls controllers, never services or databases directly. The rule is: UI → Controller → Service → Repository → Firestore or Node API. We structured it this way so that each layer has one job. If we swap Firestore for a different database, we only change the data layer — business logic stays untouched."

DRILL BEFORE NEXT SESSION (say these cold):
- Flutter startup locked answer (Session 4)
- Full architecture locked answer (above)
- What is the rule for the presentation layer? (one sentence)
- Why does the chain matter? (one sentence)

NEXT SESSION TOPIC: Riverpod — what is it, why chosen over Provider, what is a StateProvider vs FutureProvider

---

### Session 4 — March 12, 2026
Topic: Flutter startup — why getMe() is called when the app opens

WHAT YOU GOT RIGHT:
- Token is read from secure storage on app open ✅
- No token → return to onboarding ✅
- Server must validate, not Flutter — core insight landed ✅
- Expired token still exists in storage — Flutter can't detect it alone ✅
- Catch block deletes expired token and routes to onboarding ✅
- Role-based routing after successful validation ✅
- Unprompted: generated your own role analogy — "students and bus drivers all have physical access to the school but different roles access different areas." Strong viva-ready thinking.

WHAT YOU STRUGGLED WITH:
1. CRITICAL ERROR: Said token is "given by GET /api/auth/me" — WRONG. Token is created at LOGIN by jwt.sign(). getMe() only VALIDATES the existing token. Fix this before the viva.
2. Rambling under pressure — first full answer was 3+ minutes. Viva gives you 60 seconds.
3. Needed multiple pushes to land the core WHY (expired token problem). Concepts were there, precision was not.
4. Persistent pattern: logic correct, delivery loose. Needs tighter sentences.

PATTERN (4 sessions): Logic lands. Precision and delivery break under pressure.
FIX: Say the locked answer out loud every day. Your mouth needs reps. Slow down — say one sentence, check it, continue.

CRITICAL DISTINCTION TO MEMORISE:
- POST /api/auth/login → jwt.sign() → TOKEN CREATED → stored in Flutter secure storage
- GET /api/auth/me → jwt.verify() on server → TOKEN VALIDATED → user profile returned
- These are two different jobs. Never mix them up.

LOCKED ANSWER — Flutter startup:
"When the app opens, Flutter reads the JWT from secure storage. No token → go to onboarding. Token exists → we call GET /api/auth/me to let the server validate it. We can't check locally because the token could be expired — it still sits in storage but the server rejects it with 401. The catch block deletes the expired token and sends to onboarding. If valid, the server returns the user profile, we set userNotifier.state, and route them to their home screen based on role."

DRILL BEFORE NEXT SESSION (say these cold):
- Full Flutter startup locked answer (above)
- Who creates the token? When? What function?
- Who validates the token? When? What endpoint?

---

### Session 3 — March 9, 2026
Topic: Flutter interceptor — how token attaches automatically + null token gap

WHAT YOU GOT RIGHT:
- Found the word "interceptor" when pushed to look at the code
- Separation of concerns — volunteered this principle unprompted, correct usage
- Understood token is null → interceptor skips header → backend returns 401
- Identified the client-side gap: no redirect to login when token is null
- All 3 Session 2 drills passed cold before new material

WHAT YOU STRUGGLED WITH:
1. "Listen the port" — wrong. That's the server's job. Interceptor handles outgoing requests.
2. Persistent pattern: saying "are" instead of "or" under pressure (3rd session in a row)
3. Needed code open to explain null token behaviour — should know this without looking

PATTERN (3 sessions confirmed): Logic lands. Connecting words (or/are, can/cannot) break under pressure.
FIX: Before every answer, pause. Say the sentence in your head first. Then say it out loud.

LOCKED ANSWER — Flutter interceptor:
"The interceptor runs on every outgoing request. It reads the JWT from secure storage and attaches it to the Authorization header in the format Bearer <token>. This is separation of concerns — the repositories don't need to handle token attachment themselves, the interceptor does it automatically."

LOCKED ANSWER — null token gap:
"If the token is null the interceptor skips adding the header and lets the request through. The backend then rejects it with 401 because authMiddleware finds no Authorization header. This is a known weakness — a production app would redirect to login immediately on the client side."

DRILL BEFORE NEXT SESSION (say these cold):
- Walk through the full interceptor flow (what runs, what it reads, what it adds)
- What happens when token is null — and why is it a weakness?
- Flutter startup — why is getMe() called when the app opens?

---

### Session 2 — March 8, 2026
Topic: login — credential enumeration + requireRole factory function

WHAT YOU GOT RIGHT:
- Both failure cases return the same message — understood why
- requireRole factory pattern — got it after being shown the problem
- 3-question cold drill at end — passed all 3, logic was correct
- Understood req.user comes from authMiddleware before requireRole runs

WHAT YOU STRUGGLED WITH:
1. Said "invalid" when you meant "valid" — same pattern as Session 1
2. "Momentum" is not a technical word — say "confirm the email is registered"
3. Loose words under pressure: "know what exist and know what what next" — not good enough for viva
4. Took multiple pushes to land clean sentences on both topics

PATTERN (now confirmed across 2 sessions): Logic is there. Precision breaks under pressure.
FIX: Say the locked answers OUT LOUD every day before your viva. Your mouth needs reps, not just your brain.

DRILL BEFORE NEXT SESSION (say these cold):
- What is credential enumeration? (one sentence)
- Why is requireRole a factory function? (one sentence)
- Walk through what happens when a student hits an admin-only route

LOCKED ANSWER — requireRole factory:
"requireRole is a factory function because different routes need different role checks. Instead of writing a separate middleware for each one, we pass the roles in as arguments and it returns a middleware that checks them."

How it works:
- requireRole('admin', 'principal') → allowedRoles = ['admin', 'principal']
- Inner function checks: is req.user.role in that list?
- Yes → next(). No → 403 Forbidden.

LOCKED ANSWER — credential enumeration:
"Credential enumeration is when an attacker can tell whether an email exists in the system by reading the error message. We prevent it by returning the same message — 'Invalid credentials' — whether the email is wrong or the password is wrong."

---

### Session 1 — March 6, 2026
Topic: authMiddleware + register + bcrypt

WHAT YOU GOT RIGHT:
- Step 7 purpose — after being pushed 3 times, nailed it cleanly
- req.user.schoolId vs req.body.school_id — understood the cross-tenant attack
- Salt purpose — understood it protects against identical hash exposure in DB breach
- You think like an engineer — you asked about Uber, Redis, real-world scale

WHAT YOU STRUGGLED WITH (be honest — these are your study targets):
1. Mixing Step 7 with registration duplicate check — different files, different jobs
2. Saying "can" instead of "cannot" — saying the opposite of what you mean under pressure
3. "Salt is a function/method" — WRONG. Salt is a RANDOM STRING added before hashing
4. "Salt rounds = 10 means it runs 10 times" — WRONG. It means 2^10 = 1,024 iterations
5. Vague answers: "no limit and parse", "no random can get in" — not technical enough
6. Connecting salt to JWT — salt has nothing to do with JWT. Keep them separate.

PATTERN: You know the concepts. You lose precision under pressure.
FIX: Slow down. One sentence. Check it. Then continue.

WHAT TO DRILL BEFORE VIVA:
- Say the 9 authMiddleware steps from memory, in order
- Explain req.user.schoolId vs req.body in one clean sentence
- Explain salt in one clean sentence (random string, not function)
- Explain salt rounds in one clean sentence (2^n iterations, not n times)

---

## Redis — Plain English

Redis is a database that lives entirely in RAM (memory), not on disk.

Normal database (MySQL):
- Data lives on hard drive
- Reading = find file on disk → load → return
- Takes: ~5-10 milliseconds per query

Redis:
- Data lives in RAM
- Reading = look in memory → return
- Takes: ~0.1 milliseconds

That is 50-100x faster.

### What Uber uses Redis for in auth:
1. Cache user data — so authMiddleware doesn't hit MySQL every request
2. Store token blacklist — deleted/logged-out tokens go here, checked on every request
3. Store refresh tokens — fast lookup when user needs a new access token
4. Rate limit counters — "this IP has tried 5 wrong passwords, lock for 15 min"

### Redis is NOT for permanent storage
If the server restarts, Redis data can be lost (unless configured to persist).
Use MySQL for permanent data. Use Redis for fast, temporary data.

### Simple analogy
MySQL = a filing cabinet. Organised. Permanent. Slow to open.
Redis = a whiteboard on the wall. Right in front of you. Instant. Erased when you leave.

---

## bcrypt — What You Must Know Cold

### What is a salt?
A salt is a RANDOM STRING that bcrypt generates and adds to the password before hashing.
It is NOT a function. It is NOT a method. It is random data.

Result: two users with the same password get completely different hashes.
Why it matters: if a hacker steals the DB, they cannot tell who shares a password.
They must crack every hash individually — no shortcuts.

### What are salt rounds?
Salt rounds = 10 means bcrypt runs 2^10 = 1,024 hashing iterations.
Every +1 to the rounds doubles the work.
Rounds 10 = 1,024 | Rounds 11 = 2,048 | Rounds 12 = 4,096
Higher rounds = slower hash = harder brute force attack.
Cost: makes login slightly slower (~100ms at rounds=10). Acceptable tradeoff.

### What bcrypt.compare() does
bcrypt.compare(plainPassword, storedHash)
- Extracts the salt FROM the stored hash (bcrypt embeds it)
- Hashes the plain password using that same salt
- Compares result to stored hash
- Returns true or false
You never store the plain password. Ever.

---

## Viva Answer — CRITICAL FIX (updated Mar 6)

Question 3 in your viva prep was WRONG. Old answer said Firebase handles auth.
That is no longer true. Use this answer:

"How does your authentication work?"
CORRECT ANSWER:
"I built my own authentication system using bcrypt and JWT.
When a user logs in, the server verifies their password with bcrypt.compare(),
then signs a JWT containing their id, role, and schoolId.
Flutter stores the token securely using flutter_secure_storage.
Every protected request sends the token in the Authorization header,
and authMiddleware verifies it and checks the user still exists in the database.
Firebase is only used for Google Sign In and future push notifications."

---

## Next Topics to Study
- [x] authMiddleware — 9 steps (Session 1)
- [x] register — schoolId from JWT, not body (Session 1)
- [x] bcrypt — salt, salt rounds, compare (Session 1)
- [x] login — credential enumeration prevention (Session 2)
- [x] requireRole — why it's a factory function (Session 2)
- [x] Flutter interceptor — how token attaches automatically
- [x] Flutter startup — why getMe() is called on app launch (Session 4)
- [x] Flutter app architecture — 5 layers, the chain, the why (Session 5)
- [ ] Riverpod — what it is, StateProvider vs FutureProvider, why chosen over Provider
- [ ] Refresh tokens — end to end
- [ ] Rate limiting with express-rate-limit
- [ ] HTTPS and why HTTP is dangerous
