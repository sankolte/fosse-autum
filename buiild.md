osdag-secure-login/
│
├── README.md                          # Main README (all 5 required sections)
├── report.pdf                         # Your submission report
│
├── client/                            # Provided testing client (UNCHANGED)
│   ├── index.html
│   ├── mock-api.js                    # kept only for reference, not used
│   └── config.js                      # NEW: small file to toggle API base URL (custom vs appwrite)
│
├── custom-backend/                    # Express + Postgres + Prisma + JWT
│   ├── prisma/
│   │   ├── schema.prisma              # User, File, RevokedToken models
│   │   ├── migrations/
│   │   └── seed.js                    # seeds 3+ users with files
│   │
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js                 # loads & validates env vars (zod-parsed)
│   │   │   └── prisma.js              # exports single PrismaClient instance
│   │   │
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js     # verifies JWT + checks jti not revoked
│   │   │   ├── validate.middleware.js # generic zod-schema validator
│   │   │   ├── rateLimit.middleware.js
│   │   │   └── errorHandler.middleware.js
│   │   │
│   │   ├── utils/
│   │   │   ├── AppError.js
│   │   │   ├── asyncHandler.js
│   │   │   ├── jwt.js                 # sign/verify helpers
│   │   │   └── hash.js                # bcrypt wrappers
│   │   │
│   │   ├── validators/                # zod schemas
│   │   │   ├── auth.validator.js      # registerSchema, loginSchema
│   │   │   └── file.validator.js      # fileIdParamSchema
│   │   │
│   │   ├── modules/                   # feature-based, not type-based
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── auth.service.js    # business logic (hash, token issue/revoke)
│   │   │   │   └── auth.routes.js
│   │   │   │
│   │   │   ├── user/
│   │   │   │   ├── user.controller.js # GET /me
│   │   │   │   ├── user.service.js
│   │   │   │   └── user.routes.js
│   │   │   │
│   │   │   └── files/
│   │   │       ├── files.controller.js # GET /files, GET /files/:id
│   │   │       ├── files.service.js    # ownership check lives here
│   │   │       └── files.routes.js
│   │   │
│   │   ├── app.js                     # express app, mounts routes+middleware
│   │   └── server.js                  # entry point, app.listen()
│   │
│   ├── uploads/                       # seeded sample files live here (gitignored contents, .gitkeep)
│   ├── tests/
│   │   ├── auth.test.js
│   │   ├── isolation.test.js          # cross-user access denial tests
│   │   └── rateLimit.test.js
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md                      # setup steps specific to this backend
│
├── appwrite-backend/
│   ├── appwrite.json                  # exported project config (collections, permissions)
│   ├── functions/                     # only if you need custom server-side logic
│   │   └── files-access/
│   │       └── index.js               # e.g. to control 403 vs 404 response shape
│   ├── src/
│   │   ├── server.js                  # thin Express wrapper around Appwrite SDK
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── user.routes.js
│   │   │   └── files.routes.js
│   │   └── config/appwriteClient.js
│   ├── seed.js                        # script using Appwrite SDK to create 3+ users/files
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
└── docs/
    ├── architecture.png               # diagram: client → backend → db (both variants)
    ├── security-decisions.md          # expanded ambiguity/reasoning notes
    └── demo-video-link.txt
    
# Osdag Secure Login — Phase-Wise Build Plan (Agent Prompts)

Feed these to your coding agent **one phase at a time, in order**. Don't skip ahead — each
phase assumes the previous one is done and working. After each phase, run it yourself and
sanity-check before moving on.

---

## PHASE 0 — Repo Scaffold & Tooling

**Goal:** empty-but-correct skeleton for both backends + client, nothing functional yet.

**Prompt to agent:**
```
Create the following repo structure exactly as given below. Do not add extra files or
folders beyond what's listed. Initialize package.json in custom-backend/ and
appwrite-backend/ separately (two independent Node projects, not a monorepo tool like
turborepo/nx — keep it simple).

[paste the full folder tree from earlier here]

For custom-backend/package.json, add these dependencies:
express, @prisma/client, prisma (dev), zod, bcrypt, jsonwebtoken, express-rate-limit,
dotenv, cors, cookie-parser
And devDependencies: nodemon, jest, supertest

Set up .gitignore for node_modules, .env, uploads/*.actual-files (keep .gitkeep),
dist, coverage.

Do not write any business logic yet. Just scaffold empty files with a one-line comment
describing what will go in each, and working package.json / basic express server that
returns "OK" on GET / so I can confirm the skeleton runs.
```

**You verify:** `npm install && npm run dev` in `custom-backend/` starts a server, hitting `/` returns OK.

---

## PHASE 1 — Database Schema + Prisma + Seed

**Goal:** Postgres schema live, migrated, seeded with 3+ users and files.

**Prompt to agent:**
```
In custom-backend/prisma/schema.prisma, define these models:

- User: id (uuid, pk), email (unique), passwordHash, name (optional), createdAt,
  failedLoginAttempts (int, default 0), lockedUntil (datetime, nullable)
- File: id (uuid, pk), filename, path, userId (fk -> User), createdAt
- RevokedToken: jti (string, pk), expiresAt (datetime)

Relations: User has many Files.

Write prisma/seed.js that:
1. Deletes all existing rows (idempotent reseed)
2. Creates exactly 3 users: alice@test.com, bob@test.com, carol@test.com,
   all with password "Password123!" hashed with bcrypt (10 rounds)
3. Creates 2 files per user under custom-backend/uploads/<userId>/, with real small
   .txt file content written to disk (not just DB rows — actual files that /files/:id
   can stream back), and matching File rows pointing to the correct userId

Add "seed" script to package.json using prisma's seed config so `npx prisma db seed` works.
Add a README section (custom-backend/README.md) documenting the 3 seeded accounts and
their plaintext passwords for testing.

Do not write any Express routes yet — this phase is DB + seed only.
```

**You verify:** `npx prisma migrate dev` runs clean, `npx prisma studio` shows 3 users each with 2 files, actual files exist under `uploads/`.

---

## PHASE 2 — Core Utils & Middleware Skeleton (no auth logic yet)

**Goal:** the reusable plumbing — error handling, async wrapper, validation middleware, JWT helpers — all in isolation, unit-testable, before wiring routes.

**Prompt to agent:**
```
Implement these files with NO route wiring yet:

1. src/utils/AppError.js — class AppError extends Error, takes (message, statusCode),
   sets this.isOperational = true

2. src/utils/asyncHandler.js — wraps an async route handler, forwards errors to next()

3. src/middlewares/errorHandler.middleware.js — central error handler.
   - If err.isOperational, respond with { error: err.message } and err.statusCode
   - Otherwise, log the full error server-side and respond 500 with a generic
     { error: "Internal server error" } — NEVER leak stack traces or raw Prisma
     error messages to the client
   - Handle Prisma's known error codes (P2002 unique constraint, P2025 not found)
     and map them to clean AppError instances (409, 404) before they hit the generic branch

4. src/middlewares/validate.middleware.js — validate(schema) higher-order middleware
   using zod's safeParse on req.body, calls next(new AppError(...400)) on failure

5. src/utils/hash.js — hashPassword(plain) and comparePassword(plain, hash) using bcrypt

6. src/utils/jwt.js —
   - signToken(payload) → includes a random jti (use crypto.randomUUID()), 15min expiry
     for access tokens (make this configurable via env)
   - verifyToken(token) → throws on invalid/expired
   - Export both function separately so auth middleware can check jti against
     RevokedToken table AFTER verifying signature

7. src/validators/auth.validator.js — registerSchema (email valid, password min 8 chars,
   must contain a number) and loginSchema (email, password required)

Write jest unit tests for hash.js and jwt.js only (pure functions, no DB/network needed
for these). Place in tests/. Do not touch app.js or wire any routes yet.
```

**You verify:** `npm test` passes for the unit tests written so far.

---

## PHASE 3 — Auth Module (Register / Login / Logout)

**Goal:** working `/auth/register`, `/auth/login`, `/auth/logout` end to end, with rate limiting and account lockout.

**Prompt to agent:**
```
Implement src/modules/auth/ (controller, service, routes) and wire into app.js.

POST /auth/register
- Validate body with registerSchema (use validate middleware)
- Reject if email already exists — return 409 with generic-ish message
  ("Registration failed") — do not confirm existence explicitly beyond what's necessary
- Hash password, create user, do NOT auto-login (require explicit login after register)
- Return 201 with { id, email } only — never return passwordHash

POST /auth/login
- Rate limit: max 5 requests per 15 minutes per IP+email combo using express-rate-limit
  (keyGenerator combining req.ip and req.body.email)
- Check user.lockedUntil — if still locked, return 423 "Account temporarily locked"
- On wrong password: increment failedLoginAttempts; if it hits 5, set lockedUntil =
  now + 15min; ALWAYS return the same generic message regardless of whether email
  exists or password is wrong: "Invalid email or password" (401)
- On success: reset failedLoginAttempts to 0, clear lockedUntil, sign JWT (access token,
  15 min expiry, payload = { sub: user.id }), return token in an httpOnly, secure,
  sameSite=strict cookie AND in JSON body (so the test client can use either)

POST /auth/logout (protected — requires valid token)
- Extract jti from the current token's payload
- Insert { jti, expiresAt: token's original expiry } into RevokedToken table
- Clear the cookie
- Return 200

Also implement src/middlewares/auth.middleware.js now:
- Read token from Authorization: Bearer header OR cookie
- Verify signature + expiry via jwt.js
- Check RevokedToken table for that jti — if found, reject with 401 "Session expired"
- On success, attach req.user = { id: payload.sub } and call next()

Do NOT implement /me or /files yet. Write tests in tests/auth.test.js covering:
register success, duplicate email rejection, login success, login wrong password
(generic message), 5 failed logins → lockout, logout invalidates token (old token
gets 401 on a dummy protected route after logout), rate limit triggers after 5 rapid
login attempts.
```

**You verify:** all auth tests pass, manually curl register→login→logout→reuse-old-token-fails.

---

## PHASE 4 — User Profile (`/me`)

**Goal:** protected route returning only the caller's own data.

**Prompt to agent:**
```
Implement src/modules/user/ (controller, service, routes).

GET /me (protected by auth.middleware)
- Use req.user.id (from the verified token) — NEVER accept a user id from query params,
  body, or headers for this route
- Return { id, email, name, createdAt } — never passwordHash
- If somehow the user was deleted after token issue, return 401 not 404

Wire into app.js under an authenticated router group.

Write tests/me.test.js: confirms /me returns the correct logged-in user's data for
2 different seeded users using 2 different tokens, and confirms /me with no token
returns 401, and with an invalid/garbage token returns 401.
```

**You verify:** login as alice and bob separately, confirm `/me` returns different, correct data for each.

---

## PHASE 5 — Files Module (the security-critical part)

**Goal:** `/files` and `/files/:id` with correct ownership enforcement and the 403-vs-404 distinction.

**Prompt to agent:**
```
Implement src/modules/files/ (controller, service, routes).

GET /files (protected)
- Return only File rows where userId === req.user.id
- Response: array of { id, filename, createdAt } (not the raw disk path)

GET /files/:id (protected)
- Validate :id is a valid UUID using a zod param schema (files.validator.js) —
  invalid format → 400
- Look up the file by id ONLY (no userId filter in the query itself — fetch first)
- If no file with that id exists at all → 404 "File not found"
- If file exists but file.userId !== req.user.id → 403 "Forbidden"
- If file exists and belongs to caller → stream/download the actual file from disk
  using res.download() or res.sendFile(), with correct filename

This ownership check MUST live in files.service.js as an isolated, clearly named
function (e.g. assertFileOwnership(file, userId)) that throws AppError(403) or
AppError(404) — so it's easy to point to in review/interview.

Write tests/isolation.test.js — this is the most important test file in the whole repo:
- Login as alice, upload/seed context gives her 2 files — confirm GET /files returns
  exactly her 2 files, not bob's or carol's
- Login as alice, try GET /files/:bobsFileId — expect exactly 403
- Login as alice, try GET /files/00000000-0000-0000-0000-000000000000 (valid uuid,
  doesn't exist) — expect exactly 404
- Login as alice, try GET /files/not-a-uuid — expect 400
- Repeat the cross-access check for all 3 seeded users against each other's files
  (6 cross-pairs total) to be thorough
```

**You verify:** `npm test` — isolation.test.js is the file you'll want to screenshot/highlight in your report.

---

## PHASE 6 — Wire the Provided Client

**Goal:** the unmodified `index.html` test client talks to your real backend.

**Prompt to agent:**
```
I'm providing the existing index.html and mock-api.js (testing client, DO NOT MODIFY
their core logic or structure). Add a small client/config.js file only, setting the
API base URL (e.g. http://localhost:5000) that mock-api.js's fetch calls point to —
inspect mock-api.js first to see exactly what base path and endpoint names it expects
(likely /register, /login, /logout, /me, /files, /files/:id) and make sure my Express
route paths in app.js match those exact expected paths and JSON response shapes,
adding an /api prefix only if mock-api.js already expects one.

If mock-api.js expects a slightly different response shape than what I've built
(e.g. { user: {...} } vs {...} directly), tell me the mismatches explicitly rather
than silently changing my backend's response shape — I'll decide how to reconcile.

Also add cors middleware in app.js allowing the client's origin, credentials: true
(since we're using cookies for the token).
```

**You verify:** open `index.html` in browser, register/login/logout/view profile/view files all work through the real UI.

---

## PHASE 7 — Appwrite Backend

**Goal:** mirror the same 5 endpoints using Appwrite Auth + Databases + Permissions.

**Prompt to agent:**
```
Set up appwrite-backend/ as a thin Express wrapper around the Appwrite Node SDK.

1. Use Appwrite Auth (account.create, account.createEmailPasswordSession,
   account.deleteSession) for register/login/logout — do not hand-roll password
   hashing or session tokens, Appwrite handles this.

2. Create a "files" collection in Appwrite Databases with attributes:
   filename (string), path/fileId (string, references Appwrite Storage), userId (string)
   Set collection-level and document-level permissions so each file document is only
   readable by Permission.read(Role.user(ownerId)) — configure this at document
   creation time, not just collection defaults.

3. Implement routes matching the SAME contract as the custom backend:
   POST /auth/register, POST /auth/login, POST /auth/logout, GET /me, GET /files,
   GET /files/:id
   These should be thin — validate input with zod, call the Appwrite SDK, translate
   Appwrite SDK errors into the same 401/403/404 shape as the custom backend
   (Appwrite throws its own AppwriteException — catch it and re-map status codes,
   especially distinguishing "document not found" (404) from "permission denied" (403)
   which Appwrite itself will throw as 401/404 depending on config — verify this
   behavior via testing and document it in the README, since Appwrite's own error
   codes may not perfectly match 403 out of the box).

4. Write appwrite-backend/seed.js using the Appwrite SDK (server-side API key) to
   create the same 3 users (alice/bob/carol, same emails, same password) and 2 files
   each, uploading real files to Appwrite Storage and creating matching Database
   documents with correct userId and permissions.

Export the appwrite.json project config so it can be re-imported via Appwrite CLI
for reproducibility.
```

**You verify:** run the isolation checks manually against Appwrite backend too — this is where you'll likely need to hand-tune permissions, so budget real time here, not just agent output.

---

## PHASE 8 — Tests, Polish, Docs

**Goal:** final hardening pass + all written deliverables.

**Prompt to agent:**
```
1. Run through custom-backend/tests/ and appwrite-backend equivalent — ensure all pass.
2. Add a .env.example to both backends listing every required env var with dummy values
   and a one-line comment each.
3. Write custom-backend/README.md and appwrite-backend/README.md with exact setup
   commands (npm install && npx prisma migrate dev && npx prisma db seed && npm run dev),
   and list the 3 test accounts + passwords.
4. Double check: no route anywhere accepts a userId from the client to determine whose
   data to return — grep the codebase for req.body.userId, req.query.userId,
   req.params.userId used in a WHERE/find clause and flag any found.
5. Double check: no error response anywhere includes err.stack, raw Prisma error
   objects, or SQL fragments.
6. Confirm rate limiting and lockout values are read from env, not hardcoded, and
   documented in README.
```

**You do manually (agent can't do these well):**
- Write the top-level `README.md` (JWT vs session reasoning, logout mechanism, isolation
  enforcement, Appwrite auto vs configured, future improvements, ambiguity decisions)
- Write `docs/architecture.png` diagram
- Record the demo video (show a live 403 on cross-user file access — this is your
  single best "look, it's actually secure" moment)
- Write `report.pdf`

---

## Order-of-operations cheat sheet

| Phase | Output | Don't skip because |
|---|---|---|
| 0 | Skeleton | agent won't wander into wrong folder conventions later |
| 1 | Schema + seed | everything downstream needs real users/files to test against |
| 2 | Utils/middleware | reused everywhere; get it right once |
| 3 | Auth | logout invalidation is graded explicitly |
| 4 | /me | quick, but tests the "own data only" pattern before files (harder version) |
| 5 | Files | **this is what actually gets you selected** |
| 6 | Client wiring | proves it works through the real UI, not just curl |
| 7 | Appwrite | second full implementation, budget real manual time on permissions |
| 8 | Docs/tests | this is what reviewers read first — don't rush it |

