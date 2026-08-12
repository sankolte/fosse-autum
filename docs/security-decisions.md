# Security Decisions & Design Notes

This document details key architectural security decisions, authorization controls, and rate-limiting policies implemented in the Osdag Secure Login application.

---

## 1. Multi-Tenant File Authorization Strategy (IDOR Defense)

When an authenticated user requests a specific file resource via `GET /api/files/:id`:

- **Case 1: File ID does not exist in the database**
  - **Response**: `404 Not Found` (`{ "error": "File not found" }`)
  - **Rationale**: Prevents confusion and reflects standard HTTP resource lookup behaviors.

- **Case 2: File ID exists in database, but belongs to another tenant (`file.userId !== requestingUserId`)**
  - **Response**: `403 Forbidden` (`{ "error": "Access denied: You do not have permission to access this file" }`)
  - **Rationale**: Explicitly enforces Broken Access Control / Insecure Direct Object Reference (IDOR) defense. Returning HTTP 403 clearly informs authenticated users that cross-tenant data access is strictly prohibited and logged server-side, preventing unauthorized downloads while maintaining auditability.

---

## 2. JWT Invalidation & Token Revocation

Traditional stateless JWT tokens cannot be invalidated prior to natural expiration. To enable secure logouts and immediate revocation:
- Each issued access token includes a cryptographically random `jti` (JWT ID) payload claim.
- On `POST /api/auth/logout`, the token's `jti` and expiration timestamp are saved to the `RevokedToken` database table.
- The `auth.middleware.js` queries `RevokedToken` on every protected API request and rejects revoked tokens with `401 Unauthorized` (`{ "error": "Token has been revoked" }`).

---

## 3. Rate Limiting & Account Brute-Force Lockout

To defend against credential stuffing and brute-force attacks:
- **IP-Based Rate Limiting**: `POST /api/auth/login` is rate-limited to 5 requests per 15 minutes per IP address via `express-rate-limit`, responding with `429 Too Many Requests`.
- **Account Lockout**: After 5 consecutive failed login attempts on a single account, the user account is locked for 15 minutes (`lockedUntil = now + 15m`), responding with `423 Locked`.
