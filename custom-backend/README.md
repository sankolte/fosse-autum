# Custom Backend (Express + Postgres + Prisma)

## Setup Commands
This project uses NeonDB (serverless Postgres). Create a free project at [neon.tech](https://neon.tech), copy both the pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connection strings into `.env`, then run the migrate+seed commands below.

> **Note on Connection Pooling**: Serverless Postgres environments like Neon create ephemeral connections per request, which can quickly exhaust database connection limits. Using Neon's pooled connection endpoint (`-pooler`) at application runtime prevents connection pool exhaustion, while direct connections (`DIRECT_URL`) are reserved exclusively for DDL migration commands.

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Seeded Test Accounts
All seeded accounts use the default test password: `Password123!`

| User | Email | Role / Content |
| :--- | :--- | :--- |
| **Alice** | `alice@test.com` | Owns 2 test files (`alice_confidential_doc1.txt`, `alice_report_doc2.txt`) |
| **Bob** | `bob@test.com` | Owns 2 test files (`bob_confidential_doc1.txt`, `bob_report_doc2.txt`) |
| **Carol** | `carol@test.com` | Owns 2 test files (`carol_confidential_doc1.txt`, `carol_report_doc2.txt`) |
