# Appwrite Backend Wrapper

Express wrapper server mirroring the Osdag Secure Login API contract using the Appwrite Node SDK.

## Setup Instructions

1. **Environment Configuration**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your Appwrite instance credentials:
   - `APPWRITE_ENDPOINT`: Your Appwrite endpoint (e.g. `https://cloud.appwrite.io/v1`)
   - `APPWRITE_PROJECT_ID`: Your Appwrite Project ID
   - `APPWRITE_API_KEY`: Secret API Key with full administrative scopes (`users.read`, `users.write`, `databases.read`, `databases.write`, `files.read`, `files.write`)

2. **Database & Bucket Provisioning / Seeding**:
   Run the seeding script to create the `osdag-db` database, `files` collection, `user-files` storage bucket, test users, and upload files:
   ```bash
   node seed.js
   ```

3. **Start Server**:
   ```bash
   npm run dev
   ```
   The backend server will listen on `http://localhost:5001`.

## Authentication & Session Management

- **Session Creation**: Authentication on `POST /api/auth/login` uses `account.createEmailPasswordSession(email, password)` on an unauthenticated SDK client.
- **Session Validation**: All protected endpoints (`/api/user/me`, `/api/files`, `/api/files/:id`) use a shared authentication middleware that instantiates a session-scoped client (`createSessionClient(secret)`) and validates the session against Appwrite via `account.get()`. Hand-crafted or forged token strings are rejected with HTTP `401 Unauthorized`.
- **Session Revocation**: `POST /api/auth/logout` revokes the session on Appwrite servers using `account.deleteSession('current')` and clears the HTTP-only cookie.
- **Permission Enforcement**: File listing and retrieval use session-scoped `Databases` clients enforcing document-level permissions alongside application-level tenant ownership validation (defense-in-depth).

