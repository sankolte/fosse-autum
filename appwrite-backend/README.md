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
