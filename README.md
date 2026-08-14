# Osdag Secure Login

Multi-tenant authentication and secure file access system demonstrating proper authorization controls, broken access control (IDOR) defense, and security best practices. The repository contains two independent backend implementations — a custom Express + PostgreSQL + Prisma + JWT stack and an Appwrite BaaS wrapper — both exposing an identical API contract so a single unmodified web client can test either one.

> **Setup instructions live in the backend-specific READMEs:**
> - [custom-backend/README.md](custom-backend/README.md) — Express + Neon Postgres + Prisma setup
> - [appwrite-backend/README.md](appwrite-backend/README.md) — Appwrite Cloud SDK wrapper setup

---

## 2. Architecture

Both backends expose the exact same route contract (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/user/me`, `/api/files`, `/api/files/:id`), meaning the client can switch between them at runtime via a dropdown without any code changes. The client stores the active backend selection in `localStorage` and reads the base URL from `client/config.js`.

```
┌──────────────────────┐
│   client/index.html  │
│   client/app.js      │──── fetch() with Bearer token ────┐
│   client/config.js   │                                    │
└──────────────────────┘                                    │
                                                            ▼
                                    ┌─────────────────────────────────────────┐
                                    │  Backend Toggle (config.js dropdown)    │
                                    └────────┬──────────────────┬─────────────┘
                                             │                  │
                              ┌──────────────▼──────┐  ┌───────▼──────────────┐
                              │  custom-backend      │  │  appwrite-backend    │
                              │  Express + Prisma    │  │  Express + Appwrite  │
                              │  Port 5000           │  │  Node SDK            │
                              │                      │  │  Port 5001           │
                              └──────────┬───────────┘  └───────┬──────────────┘
                                         │                      │
                              ┌──────────▼───────────┐  ┌───────▼──────────────┐
                              │  PostgreSQL (Neon)    │  │  Appwrite Cloud      │
                              │  User, File,          │  │  Auth, Databases,    │
                              │  RevokedToken tables  │  │  Storage             │
                              └──────────────────────┘  └──────────────────────┘
```

| Route | Method | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | No | Create account |
| `/api/auth/login` | POST | No | Authenticate, receive token/session |
| `/api/auth/logout` | POST | Yes | Revoke token/session server-side |
| `/api/user/me` | GET | Yes | Return current user's profile |
| `/api/files` | GET | Yes | List current user's files only |
| `/api/files/:id` | GET | Yes | Download a specific file (ownership enforced) |

---

## 3. JWT vs Session-Based Authentication — My Reasoning

**Why JWT for the custom backend.** The custom backend uses stateless JWTs so that any server instance can verify a request by checking the token's cryptographic signature alone, without hitting a shared session store on every single request. The token payload carries `userId` and `email`, meaning the server never needs a database lookup just to identify the caller — it only needs the `JWT_SECRET` to verify the signature. This makes horizontal scaling straightforward: add more Express instances behind a load balancer and they all verify tokens independently.

**The tension: logout requires server-side invalidation.** Pure stateless JWT has a well-known limitation — once a token is issued, it remains valid until its natural expiration (`JWT_EXPIRES_IN`, defaulting to `15m` in `custom-backend/src/config/env.js`). If a user logs out, or if a token is compromised, there is no built-in mechanism to reject it before expiry. The task explicitly requires logout to invalidate server-side, which pure stateless JWT cannot satisfy.

**The concrete solution: hybrid with `RevokedToken` table and `jti` claim.** Every token minted by `signToken()` in `custom-backend/src/utils/jwt.js` includes a cryptographically random `jti` (JWT ID) generated via `crypto.randomUUID()`. On logout, `auth.service.js` inserts this `jti` and the token's `exp` timestamp into the `RevokedToken` table in Postgres via an upsert. On every subsequent protected request, `auth.middleware.js` first verifies the JWT signature (stateless, no DB hit if the signature is invalid), then performs a single indexed primary-key lookup on `RevokedToken` to check whether that specific `jti` has been revoked. If found, the request is rejected with `401 Unauthorized` (`"Token has been revoked"`).

This is explicitly a **hybrid approach**: cryptographic verification remains stateless, and only a minimal stateful check (one indexed lookup by primary key) is layered on top for revocation. Contrast this with a pure server-side session store, where *every* request — not just requests for revoked tokens — requires a database or Redis lookup to validate the session. The hybrid pays the cost of a DB query on every request too, but the `RevokedToken` table stays small (only revoked tokens, auto-expiring), whereas a session store grows with every active user.

---

## 4. How Logout Is Implemented Under the Hood

### Custom Backend

In `custom-backend/src/modules/auth/auth.controller.js`, the `logout` handler calls `authService.logout(req.user.jti, req.user.exp)`. At this point `req.user` has already been populated by `auth.middleware.js` from the verified JWT payload, so the `jti` is trusted — it came from the token's own claims after signature verification, not from user input.

`auth.service.js` then upserts a row into `RevokedToken` with this `jti` as the primary key and `expiresAt` derived from the token's `exp` claim (or a 15-minute fallback). The upsert avoids duplicate-key errors if a user double-clicks logout.

After the DB write, the controller calls `res.clearCookie("token")` and returns `200`. **Crucially, clearing the cookie is a client-side courtesy only — it is not the security mechanism.** Even if a malicious actor intercepts the token before the cookie is cleared, the token is already revoked in the database. Any subsequent request carrying that token will be caught by the `jti` check in `auth.middleware.js` and rejected with `401`.

The test suite (`tests/auth.test.js`) explicitly verifies this: after logout, a request to `/api/user/me` with the same token returns `401` with `"Token has been revoked"`.

### Appwrite Backend

In `appwrite-backend/src/routes/auth.routes.js`, the logout route is protected by `auth.middleware.js`, which extracts the session secret from the `Authorization: Bearer` header (or `token` cookie), creates a session-scoped client via `createSessionClient(secret)`, and validates it by calling `account.get()` on Appwrite's servers. If validation succeeds, `req.appwriteSession` is set to the raw session secret.

The logout handler then creates a *new* session-scoped client from `req.appwriteSession` and calls `sessionAccount.deleteSession("current")`. This tells Appwrite's server to invalidate that specific session. The important detail: this uses the session-scoped client, not the admin-keyed client — the user can only revoke their own session, not anyone else's. After revocation, any subsequent request using that session secret will fail at the `account.get()` call in the auth middleware, because Appwrite itself rejects it.

---

## 5. How User Data Isolation Is Enforced

### Custom Backend

**No user ID is ever accepted from the client.** The `/api/user/me` route calls `userService.getUserProfile(req.user.userId)`, and `/api/files` calls `filesService.getFilesForUser(req.user.userId)` — in both cases `req.user.userId` is extracted from the verified JWT payload by `auth.middleware.js`, never from URL params, request body, or headers. A client cannot forge or substitute another user's ID without forging the JWT signature itself.

**`GET /api/files/:id` — the three-way branch in `files.service.js`:**

1. **File ID does not exist in the database** → `prisma.file.findUnique` returns `null` → throw `AppError("File not found", 404)`.
2. **File ID exists, but `file.userId !== requestingUserId`** → throw `AppError("Access denied: You do not have permission to access this file", 403)`. This is the explicit IDOR defense.
3. **File ID exists and `file.userId === requestingUserId`** → resolve the file path, verify the physical file exists on disk via `fs.existsSync`, and stream it via `res.sendFile()`.

This ownership check lives in a dedicated function (`getFileById`) in `custom-backend/src/modules/files/files.service.js`, not scattered across controllers. The file's `path` field is never exposed in the `GET /api/files` listing response — `getFilesForUser` uses a Prisma `select` that returns only `id`, `filename`, and `createdAt`.

**Test coverage:** `tests/isolation.test.js` creates two mock users (User A and User B) with one file each, then verifies all branches: User A can access their own file (200), User A accessing User B's file gets 403 with `"Access denied"`, a non-existent UUID gets 404, and a malformed non-UUID string gets 400 from the Zod `fileIdParamSchema` validator.

### Appwrite Backend

The Appwrite backend enforces isolation through **two independent layers**:

**Layer 1 — Appwrite's native document-level permissions.** At seed/creation time (`appwrite-backend/seed.js`), every file document is created with `Permission.read(Role.user(user.$id))` — meaning only the owning user's session can read that document through the Appwrite API. When the `GET /api/files` and `GET /api/files/:id` routes query Appwrite using a session-scoped `Databases` client (`new sdk.Databases(sessionClient)`), Appwrite's own permission engine filters results before they ever reach the Express handler. A session-scoped query for another user's document will be rejected by Appwrite itself.

**Layer 2 — Application-level ownership check.** Even after Appwrite's permission layer passes, `files.routes.js` performs an explicit `if (fileDoc.userId !== req.user.id)` check and returns 403. This is defense-in-depth: if a permission misconfiguration were ever introduced, the application code still blocks cross-tenant access.

**Why the admin client is used narrowly.** The `appwriteClient.js` module exports both an admin-keyed client (with `.setKey()`) and a `createSessionClient()` factory (with `.setSession()`). The admin client bypasses all Appwrite permission checks, so using it for user-facing reads would nullify Layer 1 entirely. It is used in only two places: (1) user registration in `auth.routes.js` (via `users.create()`), because creating users requires admin privileges, and (2) a narrow existence-check in `files.routes.js` to distinguish 403 from 404 — when the session-scoped client rejects a file request, the admin client checks whether the document ID exists at all. If it does, the response is 403 (exists but not yours); if even the admin lookup fails, it's 404 (does not exist). Every other database and storage read in user-facing routes uses the session-scoped client.

---

## 6. What Appwrite Handled Automatically vs What I Configured Myself

**Automatic (handled by Appwrite's engine):**
- Password hashing and secure storage — no `bcrypt` configuration needed.
- Session token generation, cryptographic signing, and expiry management.
- Session validation — `account.get()` validates and rejects expired/revoked sessions internally.
- User uniqueness enforcement on registration (duplicate email → `409`).
- Session revocation mechanics — `account.deleteSession("current")` invalidates server-side.

**Configured and built by me:**
- Document-level read permissions scoped per user at file creation time (`Permission.read(Role.user(userId))` in `seed.js`), with document security enabled on the collection.
- The session-vs-admin client separation pattern in `appwriteClient.js` — explicitly avoiding admin-keyed access on user-facing routes to prevent accidental privilege escalation past Appwrite's permission layer.
- The thin Express wrapper layer (`src/server.js`, `src/routes/*`) translating Appwrite SDK responses and exceptions into the same `{ error: "..." }` JSON response shape and HTTP status codes (`401`/`403`/`404`/`409`) used by the custom backend, so the client works identically against both.
- The application-level ownership check (`fileDoc.userId !== req.user.id`) as defense-in-depth beyond Appwrite's native permissions.
- The admin-client existence probe in `files.routes.js` to produce 403 vs 404 semantics matching the custom backend.
- IP-based login rate limiting via `express-rate-limit` in `appwrite-backend/src/middlewares/rateLimit.middleware.js`, applied to `POST /api/auth/login` in `auth.routes.js` — 5 requests per 15 minutes per IP, returning `429 Too Many Requests`.

---

## 7. Multi-User Test Accounts

Both backends seed the same three test identities for consistency during review:

| User | Email |
| :--- | :--- |
| **Alice** | `alice@test.com` |
| **Bob** | `bob@test.com` |
| **Carol** | `carol@test.com` |

Each user owns 2 seeded files (e.g., `alice_confidential_doc1.txt`, `alice_report_doc2.txt`).

Passwords and per-file details are documented in [custom-backend/README.md](custom-backend/README.md#seeded-test-accounts). Both `prisma/seed.js` and `appwrite-backend/seed.js` use the same default password for all three accounts.

---

## 8. Notable Ambiguous Decisions & My Reasoning

**Session token delivery: cookie AND JSON body.** Both backends return the token/session secret in an `httpOnly` cookie (`res.cookie("token", ...)`) *and* in the JSON response body (`{ token: ... }`). The client (`client/app.js`) reads the token from the JSON body and stores it in `localStorage`, then sends it as a `Bearer` header on subsequent requests. Both auth middlewares accept either mechanism — `Authorization: Bearer <token>` header first, falling back to the `token` cookie. This dual delivery slightly increases surface area (the token exists in two places), but avoids guessing which mechanism a grading client or automated test might expect. Since the cookie is `httpOnly` (not accessible to JavaScript in same-origin XSS), the real risk addition is minimal.

**Registration does not auto-login on the Appwrite backend.** The custom backend returns a token on registration (the client can use it immediately), but the Appwrite backend returns a success message and requires an explicit login call to create a session. This is intentional: Appwrite's registration (`users.create`) is an admin-scoped operation that does not create a user session, and silently creating a session behind the scenes after registration would require a separate `createEmailPasswordSession` call with the raw password — meaning the password would be used twice in one request handler, stored briefly in memory longer than necessary. Explicit login after registration is clearer and avoids that.

**Rate limiting strategy: IP-level throttle + per-account lockout (custom backend).** The custom backend applies *two* independent layers. First, `express-rate-limit` in `rateLimit.middleware.js` throttles `POST /api/auth/login` to 5 requests per 15 minutes per source IP, responding `429`. This runs before any application logic. Second, `auth.service.js` tracks `failedLoginAttempts` per user record — after 5 consecutive failures on a specific account, it sets `lockedUntil` to 15 minutes in the future and responds `423 Locked`. These are complementary: IP-level rate limiting stops distributed credential-stuffing attacks, while per-account lockout prevents a single targeted account from being brute-forced even from rotating IPs. The Appwrite backend applies IP-level rate limiting only (no per-account lockout), since Appwrite handles password verification internally and does not expose a failed-attempt counter through its SDK.

**403 vs 404 semantics on `/files/:id`.** When a valid authenticated user requests a file ID that exists but belongs to another tenant, the response is `403 Forbidden` rather than `404 Not Found`. This was an explicit requirement in the task specification. The alternative view — always returning `404` to avoid confirming that a file with that ID exists — has merit from a pure information-leakage perspective (an attacker cannot distinguish "this ID exists but isn't mine" from "this ID doesn't exist at all"). However, the task required clear, auditable differentiation between "resource does not exist" and "you are not authorized to access this resource," and returning `403` makes access-control violations visible in logs and to the client for security auditing purposes. The implementation follows the task requirement.

**CORS configured with `origin: true`.** Both backends use `cors({ origin: true, credentials: true })`, which reflects the request's `Origin` header back as `Access-Control-Allow-Origin`. In production this should be locked to specific allowed origins. For this project — where the client is opened as a local file or served from an arbitrary port during review — `origin: true` avoids CORS rejections without requiring the reviewer to configure a specific origin. This is a conscious tradeoff of review ergonomics over production hardening.

**Zod validation on custom backend only.** The custom backend validates all request bodies and params through Zod schemas (`auth.validator.js`, `file.validator.js`) before they reach business logic. The Appwrite backend does not replicate this, because Appwrite's server-side SDK performs its own input validation (e.g., rejecting invalid emails, enforcing password rules) and returns structured errors. Adding a Zod layer on top would be redundant validation of inputs that Appwrite will validate anyway. The tradeoff is that Appwrite backend error messages are less consistent in format — they come from Appwrite's SDK rather than from a controlled Zod schema.

---

## 9. What I Would Improve With More Time

- **Refresh token rotation.** Currently the custom backend issues a single access token with a 15-minute expiry. A production system should issue short-lived access tokens alongside a long-lived refresh token, with rotation on each refresh to limit the window of token theft.
- **Move uploaded files to object storage.** The custom backend stores user files on the local filesystem (`uploads/` directory). This doesn't survive container restarts and can't scale to multiple instances. Moving to an S3-compatible object store (or Neon's blob storage) would fix both problems.
- **Email verification on registration.** Neither backend verifies that the user owns the email address they register with. Adding a verification step (confirmation link or OTP) would prevent account squatting and provide a recovery channel.
- **Structured logging and audit trail.** Failed login attempts, account lockouts, 403 access denials, and token revocations are currently logged via `console.log`/`console.error`. A structured logging library (e.g., Pino or Winston) with JSON output would make these events queryable and shippable to a centralized log aggregator for security monitoring.
- **Containerized reviewer setup.** Both backends require manual environment configuration (Neon connection strings, Appwrite API keys). A `docker-compose.yml` running a local Postgres instance, seeding the database, and starting the custom backend in one command would eliminate setup friction for reviewers.
- **CI pipeline.** The Jest test suite (`tests/`) runs locally but is not wired to a CI system. A GitHub Actions workflow running `npm test` on every push would catch regressions before merge.
- **Automated cleanup of expired `RevokedToken` rows.** The `RevokedToken` table grows with every logout. Rows whose `expiresAt` has passed are no longer useful (the underlying JWT has expired naturally). A scheduled cleanup job or Prisma middleware to purge expired rows would keep the table small.

---

## 10. Repository Structure

```
osdag-secure-login/
├── README.md                           # This file
├── client/
│   ├── index.html                      # Single-page testing UI
│   ├── app.js                          # Client logic & API calls
│   ├── config.js                       # Backend URL toggle (custom vs appwrite)
│   └── mock-api.js                     # Kept for reference, not used
│
├── custom-backend/                     # Express + Postgres + Prisma + JWT
│   ├── prisma/
│   │   ├── schema.prisma              # User, File, RevokedToken models
│   │   └── seed.js                    # Seeds 3 users with 2 files each
│   ├── src/
│   │   ├── app.js                     # Express app, mounts routes + middleware
│   │   ├── server.js                  # Entry point, app.listen()
│   │   ├── config/
│   │   │   ├── env.js                 # Zod-validated environment variables
│   │   │   └── prisma.js             # Singleton PrismaClient instance
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js     # JWT verification + jti revocation check
│   │   │   ├── validate.middleware.js # Generic Zod schema validator
│   │   │   ├── rateLimit.middleware.js # IP-based login rate limiter
│   │   │   └── errorHandler.middleware.js
│   │   ├── utils/
│   │   │   ├── AppError.js           # Operational error class
│   │   │   ├── asyncHandler.js       # Async route error wrapper
│   │   │   ├── jwt.js                # sign/verify with jti generation
│   │   │   └── hash.js              # bcrypt wrappers
│   │   ├── validators/
│   │   │   ├── auth.validator.js     # registerSchema, loginSchema
│   │   │   └── file.validator.js     # fileIdParamSchema (UUID validation)
│   │   └── modules/
│   │       ├── auth/
│   │       │   ├── auth.controller.js
│   │       │   ├── auth.service.js   # Register, login (with lockout), logout (jti revoke)
│   │       │   └── auth.routes.js
│   │       ├── user/
│   │       │   ├── user.controller.js
│   │       │   ├── user.service.js
│   │       │   └── user.routes.js
│   │       └── files/
│   │           ├── files.controller.js
│   │           ├── files.service.js  # Ownership check (IDOR defense)
│   │           └── files.routes.js
│   ├── tests/
│   │   ├── auth.test.js              # Register, login, lockout, logout+revocation
│   │   ├── isolation.test.js         # Cross-user file access denial
│   │   ├── rateLimit.test.js         # 429 after 5 login attempts
│   │   ├── jwt.test.js              # Token signing and verification
│   │   └── hash.test.js            # Bcrypt hash and compare
│   ├── uploads/                      # Seeded sample files (per-user subdirectories)
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
├── appwrite-backend/                  # Appwrite BaaS Express wrapper
│   ├── appwrite.json                 # Exported Appwrite project config
│   ├── seed.js                       # Creates DB, collection, bucket, users, files
│   ├── src/
│   │   ├── server.js                 # Express wrapper, port 5001
│   │   ├── config/
│   │   │   └── appwriteClient.js    # Admin client + session client factory
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js    # Session validation via account.get()
│   │   │   └── rateLimit.middleware.js # IP-based login rate limiter
│   │   └── routes/
│   │       ├── auth.routes.js       # Register, login (rate-limited), logout
│   │       ├── user.routes.js       # GET /me
│   │       └── files.routes.js      # List + download with IDOR defense
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
└── docs/
    ├── security-decisions.md         # Detailed security architecture notes
    └── demo-video-link.txt
```
