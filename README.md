# Osdag Secure Login

Multi-tenant authentication and secure file access system demonstrating proper authorization controls, broken access control defense, and security best practices.

## Overview
This repository contains two backend implementations and a web client:
1. **Custom Express Backend**: Built with Express, PostgreSQL, Prisma, JWT, Zod, Bcrypt, and Rate Limiting.
2. **Appwrite Backend**: Built using Appwrite BaaS (Auth, Database & Storage).
3. **Client**: Web interface for testing registration, login, profile view, and file access.

## Project Structure
- `client/` - Web frontend testing client
- `custom-backend/` - Express + Postgres + Prisma implementation
- `appwrite-backend/` - Appwrite integration wrapper
- `docs/` - Architecture diagrams & security documentation
