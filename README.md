# Server Documentation

## Overview

This server is a Node.js backend built with [Fastify](https://www.fastify.io/) and [tRPC](https://trpc.io/), providing a REST-like API for managing users, companies, debtors, and creditors. It uses PostgreSQL for data storage (via [Drizzle ORM](https://orm.drizzle.team/)), Redis for caching and session management, and supports integration with external web services.

---

## Architecture

- **Entry Point:** `src/index.ts`
- **Frameworks:** Fastify, tRPC
- **Database:** PostgreSQL (Drizzle ORM)
- **Cache/Session:** Redis
- **API Structure:** All endpoints are exposed under `/trpc` using tRPC routers.

---

## Main Features

### 1. User Management

- **CRUD operations** for users (create, read, update, delete, batch delete)
- **Password hashing** with bcrypt
- **Role-based fields** (role, email, etc.)
- **Pagination, sorting, and search** for user lists

### 2. Company Management

- **CRUD operations** for companies
- **Select and get selected company** (session-based)
- **Pagination, sorting, and search** for company lists

### 3. Debtor & Creditor Management

- **Fetch lists of debtors and creditors** for a selected company and period
- **Integration with external web services** (via HTTP POST, session-based authentication)
- **Error handling** for web service responses

---

## API Endpoints (tRPC Routers)

All endpoints are available under `/trpc`.

- `/trpc/user` - User management
- `/trpc/company` - Company management
- `/trpc/debtor` - Debtor data (external integration)
- `/trpc/creditor` - Creditor data (external integration)

Each router exposes multiple procedures (queries and mutations) for CRUD and business operations.

---

## Database Schema

### Users Table

| Field         | Type      | Description        |
| ------------- | --------- | ------------------ |
| id            | serial    | Primary key        |
| name          | varchar   | User's name        |
| email         | varchar   | User's email       |
| phone         | varchar   | User's phone       |
| password      | varchar   | Hashed password    |
| role          | varchar   | User role          |
| creationDate  | timestamp | Creation timestamp |
| updatedOn     | timestamp | Last update        |
| last_login_at | timestamp | Last login         |

### Companies Table

| Field              | Type      | Description                |
| ------------------ | --------- | -------------------------- |
| id                 | serial    | Primary key                |
| code               | varchar   | Company code               |
| name               | varchar   | Company name               |
| manager            | varchar   | Manager name               |
| phone              | varchar   | Phone number               |
| licenseDate        | timestamp | License date               |
| status             | boolean   | Active/inactive            |
| webServiceSource   | varchar   | Web service URL            |
| webServiceUsername | varchar   | Web service username       |
| serverName         | varchar   | Server name                |
| period             | integer   | Accounting period          |
| apiKey             | varchar   | API key for web service    |
| apiSecret          | varchar   | API secret for web service |
| creationDate       | timestamp | Creation timestamp         |
| updatedOn          | timestamp | Last update                |

---

### UsersToCompanies Table

| Field      | Type                    | Description        |
| ---------- | ----------------------- | ------------------ |
| user_id    | integer                 | Primary key        |
| company_id | integer                 | Company code       |
| created_at | timestamp with timezone | Creation timestamp |

---

## Authentication & Session Management

- **Sessions** are managed using `fastify-session` with Redis as the store.
- **Session data** includes selected company and web service session IDs.
- **Password hashing** uses bcrypt with a configurable salt round.
- **No explicit login endpoint** is present; authentication is likely handled via session and external web service login.

---

## External Integrations

- **Debtor and Creditor data** are fetched from an external web service using company credentials.
- **Session-based authentication** is performed before each external request.
- **Responses** are parsed and errors are handled according to HTTP and business logic.

---

## Metrics & Compression

- **Prometheus metrics** are available at `/metrics`.
- **Gzip compression** is enabled globally.

---

## Environment Variables

- `PORT` - Server port
- `CORS_ORIGIN` - Allowed CORS origins
- `REDIS_SECRET` - Redis password
- `SESSION_SECRET` - Session secret
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` - PostgreSQL connection

---

## Project Structure

- `src/index.ts` - Main server entry
- `src/trpc/router/` - tRPC routers (user, company, debtor, creditor)
- `src/db/schema/` - Database schema definitions
- `src/services/` - Business logic, Redis, web service integration
- `src/types/` - TypeScript types

---

## How to Run

1. Install dependencies: `npm install`
2. Set up environment variables in a `.env` file.
3. Start the server: `npm run dev` (or the appropriate script)
4. Access the API at `http://localhost:<PORT>/trpc`
