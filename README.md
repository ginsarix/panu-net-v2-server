# Server Documentation

## Overview

This server is a Node.js backend built with [Fastify](https://www.fastify.io/) and [tRPC](https://trpc.io/), providing a comprehensive API for managing users, companies, debtors, creditors, subscriptions, orders, reports, and more. It uses PostgreSQL for data storage (via [Drizzle ORM](https://orm.drizzle.team/)), Redis for session management, and supports integration with external web services, email notifications, and SMS services.

---

## Architecture

- **Entry Point:** `src/index.ts`
- **Frameworks:** Fastify 5.x, tRPC 11.x
- **Database:** PostgreSQL (Drizzle ORM)
- **Cache/Session:** Redis (ioredis)
- **Background Jobs:** Node-cron (subscription expiry reminders, daily at 5 AM)
- **Error Tracking:** Sentry
- **API Structure:** All endpoints are exposed under `/trpc` using tRPC routers.

---

## Main Features

### 1. User Management

- **CRUD operations** for users (create, read, update, delete, batch delete)
- **Password hashing** with bcrypt
- **Role-based access control** via page roles (permission modules)
- **Pagination, sorting, and search** for user lists

### 2. Company Management

- **CRUD operations** for companies
- **Select and get selected company** (session-based)
- **Web service credentials** per company (URL, username, API key/secret)
- **Pagination, sorting, and search** for company lists

### 3. Debtor & Creditor Management

- **Fetch lists of debtors and creditors** for a selected company and period
- **Integration with external SIS web service** (HTTP POST, session-based authentication)
- **Error handling** for web service responses

### 4. Subscription Management

- **CRUD operations** for subscriptions (domain, SSL, hosting, mail)
- **Subscription customer management** with contact preferences
- **Automated expiry notifications** via email and SMS (30, 15, 7 days before expiry)

### 5. Orders, Contracts, Stocks, Waybills & Tickets

- Full domain feature routers for orders, contracts, stock, waybill, and support tickets

### 6. Reporting & Audit Log

- **Business reporting** with period filtering
- **Paginated audit log** (`event-log`) for tracking all user actions

---

## API Endpoints (tRPC Routers)

All endpoints are available under `/trpc`.

- `/trpc/auth` - Login, logout, password reset, 2FA, device key management
- `/trpc/user` - User management
- `/trpc/company` - Company management
- `/trpc/debtor` - Debtor data (external SIS integration)
- `/trpc/creditor` - Creditor data (external SIS integration)
- `/trpc/subscription` - Subscription management
- `/trpc/subscriptionCustomer` - Subscription customer management
- `/trpc/report` - Business reporting
- `/trpc/definition` - Definition management
- `/trpc/contract` - Contract management
- `/trpc/stock` - Stock management
- `/trpc/order` - Order management
- `/trpc/waybill` - Waybill management
- `/trpc/ticket` - Support ticket management
- `/trpc/pageRole` - Permission module management
- `/trpc/eventLog` - Audit log retrieval

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

### UsersToCompanies Table

| Field      | Type                    | Description        |
| ---------- | ----------------------- | ------------------ |
| user_id    | integer                 | Foreign key → user |
| company_id | integer                 | Foreign key → company |
| created_at | timestamp with timezone | Creation timestamp |

### Subscriptions Table

| Field            | Type      | Description                        |
| ---------------- | --------- | ---------------------------------- |
| id               | serial    | Primary key                        |
| startDate        | date      | Subscription start date            |
| endDate          | date      | Subscription end date              |
| subscriptionType | enum      | Type: domain, ssl, hosting, mail   |
| customerId       | integer   | Reference to subscription customer |
| creationDate     | timestamp | Creation timestamp                 |
| updatedOn        | timestamp | Last update                        |

### SubscriptionCustomers Table

| Field                 | Type      | Description               |
| --------------------- | --------- | ------------------------- |
| id                    | serial    | Primary key               |
| name                  | varchar   | Customer name             |
| email                 | varchar   | Customer email            |
| phone                 | varchar   | Customer phone            |
| remindExpiryWithEmail | boolean   | Email reminder preference |
| remindExpiryWithSms   | boolean   | SMS reminder preference   |
| creationDate          | timestamp | Creation timestamp        |
| updatedOn             | timestamp | Last update               |

### EventLogs Table

| Field        | Type                    | Description                        |
| ------------ | ----------------------- | ---------------------------------- |
| id           | serial                  | Primary key                        |
| resourceType | text                    | Resource type (in Turkish)         |
| resourceId   | text                    | ID of the affected resource        |
| action       | text                    | Action performed (in Turkish)      |
| actorId      | integer                 | Foreign key → user (nullable)      |
| status       | text                    | Outcome (`başarılı` / `başarısız`) |
| ipAddress    | text                    | Client IP address                  |
| userAgent    | text                    | Client user agent                  |
| createdAt    | timestamp with timezone | Creation timestamp                 |

---

## Authentication & Session Management

- **Sessions** are managed using `@mgcrea/fastify-session` with Redis as the store (24h TTL).
- **Session data** includes `userId`, `selectedCompanyId`, and `externalSessionId` (for web service auth).
- **Password hashing** uses bcrypt with 10 salt rounds.
- **Login/logout** and full 2FA flow are exposed via the `/trpc/auth` router.

---

## Background Jobs

- **Node-cron** schedules the subscription reminder job daily at 5 AM.
- **Subscription reminder** (`src/services/jobs/subscription-reminder.ts`) sends email and SMS notifications for subscriptions expiring in 7, 15, and 30 days based on customer preferences.
- No separate worker process is needed — jobs run inside the main server process.

---

## External Integrations

- **Debtor and Creditor data** are fetched from an external SIS web service using company credentials.
- **Session-based authentication** is performed before each external request; the session ID is stored in the user's server session.
- **Email service** via Nodemailer (SMTP) for subscription notifications.
- **SMS service** via NetGSM REST API for subscription reminders.

---

## Compression

- **Gzip compression** is enabled globally on all responses.

---

## Environment Variables

| Variable             | Description                                 |
| -------------------- | ------------------------------------------- |
| `NODE_ENV`           | `development`, `production`, or `test`      |
| `PORT`               | Server port (default: `3000`)               |
| `CORS_ORIGIN`        | Allowed CORS origin URL                     |
| `REDIS_URI`          | Redis connection URI (includes auth)        |
| `SESSION_KEY`        | Base64-encoded 32+ byte session secret      |
| `DB_HOST`            | PostgreSQL host                             |
| `DB_USER`            | PostgreSQL user                             |
| `DB_PASS`            | PostgreSQL password                         |
| `DB_NAME`            | PostgreSQL database name                    |
| `SMTP_USER`          | SMTP email address                          |
| `SMTP_PASS`          | SMTP password                               |
| `NETGSM_HEADER`      | NetGSM SMS sender header                    |
| `NETGSM_USERNAME`    | NetGSM username                             |
| `NETGSM_PASSWORD`    | NetGSM password                             |
| `SENTRY_DSN`         | Sentry DSN (optional, production only)      |
| `FAKE_2FA`           | Set `true` in development to skip real 2FA  |

All variables are validated at startup via `src/config/env.ts` using Zod.

---

## Project Structure

```
src/
├── index.ts                      # Main server entry point
├── config/env.ts                 # Environment variable validation (Zod)
├── constants/                    # App-wide constants (auth, pagination, page roles)
├── db/
│   └── schema/                   # Drizzle ORM table definitions & relations
├── router/
│   └── file.ts                   # Fastify file upload route (/upload)
├── services/
│   ├── jobs/                     # Background cron jobs
│   │   └── subscription-reminder.ts
│   ├── zod-validations/          # Zod input schemas
│   ├── web-service/              # External SIS API integration
│   ├── redis.ts                  # Redis client
│   ├── logger.ts                 # Pino logger singleton
│   └── netgsm.ts                 # NetGSM SMS wrapper
├── trpc/
│   ├── context.ts                # tRPC request context
│   └── router/                   # tRPC routers (auth, user, company, …)
├── types/                        # TypeScript type definitions
└── utils/                        # Helpers (auth, email, file, crypto, event-log)
```

---

## How to Run

### Setup

1. Install dependencies: `npm install`
2. Set up environment variables in a `.env` file (see Environment Variables above).
3. Run database migrations: `npm run drizzle:migrate`
4. Start the development server: `npm run dev`
5. Access the API at `http://localhost:3000/trpc`

### Available Scripts

| Script                        | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `npm run dev`                 | Start development server with auto-reload        |
| `npm run dev:debug`           | Start development server with Node debugger      |
| `npm run build`               | Compile TypeScript and upload Sentry source maps |
| `npm run start`               | Run compiled production server (`dist/index.js`) |
| `npm run lint`                | Run ESLint                                       |
| `npm run format`              | Format source files with Prettier                |
| `npm run drizzle:generate`    | Generate migration files from schema changes     |
| `npm run drizzle:migrate`     | Run pending database migrations                  |
| `npm run drizzle:studio`      | Open Drizzle Studio for visual DB inspection     |
