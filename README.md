# Server Documentation

## Overview

This server is a Node.js backend built with [Fastify](https://www.fastify.io/) and [tRPC](https://trpc.io/), providing a comprehensive API for managing users, companies, debtors, creditors, subscriptions, and task tracking. It uses PostgreSQL for data storage (via [Drizzle ORM](https://orm.drizzle.team/)), Redis for caching and session management, and supports integration with external web services, email notifications, and SMS services.

---

## Architecture

- **Entry Point:** `src/index.ts`
- **Frameworks:** Fastify, tRPC
- **Database:** PostgreSQL (Drizzle ORM)
- **Cache/Session:** Redis
- **Queue System:** BullMQ for background job processing
- **API Structure:** All endpoints are exposed under `/trpc` using tRPC routers.

---

## Main Features

### 1. User Management

- **CRUD operations** for users (create, read, update, delete, batch delete)
- **Password hashing** with bcrypt
- **Role-based fields** (role, email, etc.)
- **Pagination, sorting, and search** for user lists
- **Redis caching** for user lists

### 2. Company Management

- **CRUD operations** for companies
- **Select and get selected company** (session-based)
- **Pagination, sorting, and search** for company lists
- **Redis caching** for company lists

### 3. Debtor & Creditor Management

- **Fetch lists of debtors and creditors** for a selected company and period
- **Integration with external web services** (via HTTP POST, session-based authentication)
- **Error handling** for web service responses

### 4. Subscription Management

- **CRUD operations** for subscriptions (domain, SSL, hosting, mail)
- **Subscription customer management** with contact preferences
- **Automated expiry notifications** via email and SMS
- **Background job processing** for subscription expiry reminders

### 5. Task Tracking

- **Customer management** for subscription tracking
- **Subscription expiry monitoring** with automated notifications
- **Email and SMS integration** for customer communications

---

## API Endpoints (tRPC Routers)

All endpoints are available under `/trpc`.

- `/trpc/user` - User management
- `/trpc/company` - Company management
- `/trpc/debtor` - Debtor data (external integration)
- `/trpc/creditor` - Creditor data (external integration)
- `/trpc/subscription` - Subscription management
- `/trpc/subscriptionCustomer` - Subscription customer management

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

### Subscriptions Table

| Field            | Type      | Description                        |
| ---------------- | --------- | ---------------------------------- |
| id               | serial    | Primary key                        |
| startDate        | date      | Subscription start date            |
| endDate          | date      | Subscription end date              |
| subscriptionType | enum      | Type: domain, ssl, hosting, mail   |
| userId           | integer   | Reference to subscription customer |
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

---

## Authentication & Session Management

- **Sessions** are managed using `fastify-session` with Redis as the store.
- **Session data** includes selected company and web service session IDs.
- **Password hashing** uses bcrypt with a configurable salt round.
- **No explicit login endpoint** is present; authentication is likely handled via session and external web service login.

---

## Queue System & Background Workers

- **BullMQ** is used for background job processing
- **Subscription expiry worker** runs daily to check for expiring subscriptions
- **Email notifications** are sent for subscriptions expiring in 30, 15, and 7 days
- **SMS notifications** are sent via NetGSM integration
- **Worker processes** can be run separately using `npm run dev:worker` or `npm run start:worker`

### Available Workers

- **Subscription Expiry Worker** (`src/services/queue-system/workers/subscription-expiry-worker.ts`)
  - Checks for subscriptions expiring in 30, 15, and 7 days
  - Sends email and SMS notifications based on customer preferences
  - Runs automatically every 24 hours

---

## External Integrations

- **Debtor and Creditor data** are fetched from an external web service using company credentials.
- **Session-based authentication** is performed before each external request.
- **Responses** are parsed and errors are handled according to HTTP and business logic.
- **Email service** integration for subscription notifications
- **SMS service** integration via NetGSM for subscription reminders

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
- `REDIS_URI` - Redis connection URI
- `NETGSM_USERNAME`, `NETGSM_PASSWORD` - NetGSM SMS service credentials
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` - Email service configuration

---

## Project Structure

- `src/index.ts` - Main server entry
- `src/trpc/router/` - tRPC routers (user, company, debtor, creditor, subscription, subscriptionCustomer)
- `src/db/schema/` - Database schema definitions
- `src/services/` - Business logic, Redis, web service integration, queue system
- `src/services/queue-system/` - Background job processing (BullMQ)
- `src/services/queue-system/workers/` - Background workers
- `src/types/` - TypeScript types
- `src/utils/` - Utility functions (email, formatting)

---

## Client Application

The project includes a Vue.js 3 frontend application built with:

- **Framework:** Vue 3 with Composition API
- **UI Library:** Vuetify 3
- **State Management:** Pinia
- **Routing:** Vue Router
- **HTTP Client:** tRPC client
- **Build Tool:** Vite
- **TypeScript:** Full TypeScript support

### Client Features

- **Dashboard** with KPIs and quick links
- **User Management** (admin only)
- **Company Management** (admin only)
- **Debtor & Creditor Management** with external data integration
- **Subscription Management** with expiry tracking
- **Task Tracking** for subscription customers
- **Reports** with general reporting functionality
- **Responsive Design** with mobile support

### Client Navigation Structure

- **Home** - Dashboard with statistics and quick access
- **Debtors & Creditors** - External data integration
- **Task Tracking** - Subscription and customer management
- **Management** - User and company administration (admin only)
- **Orders** - Order management (planned)
- **Reports** - General reporting functionality

---

## How to Run

### Server Setup

1. Navigate to the server directory: `cd server`
2. Install dependencies: `npm install`
3. Set up environment variables in a `.env` file.
4. Run database migrations: `npm run drizzle:migrate`
5. Start the server: `npm run dev`
6. (Optional) Start background workers: `npm run dev:worker`
7. Access the API at `http://localhost:<PORT>/trpc`

### Client Setup

1. Navigate to the client directory: `cd client`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Access the application at `http://localhost:5173`

### Full Stack Development

1. Start the server (from `server/` directory): `npm run dev`
2. Start the client (from `client/` directory): `npm run dev`
3. The client will automatically connect to the server API

### Available Scripts

- `npm run dev` - Start development server
- `npm run dev:worker` - Start background workers in development
- `npm run dev:debug` - Start server with debugging enabled
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run start:worker` - Start background workers in production
- `npm run drizzle:generate` - Generate database migrations
- `npm run drizzle:migrate` - Run database migrations
- `npm run drizzle:studio` - Open Drizzle Studio for database management
