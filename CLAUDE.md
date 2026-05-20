# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**panu-net-v2-server** is a Node.js backend API built with:
- **Framework**: Fastify 5.x with tRPC 11.x for end-to-end type-safe APIs
- **Database**: PostgreSQL with Drizzle ORM (schema-driven migrations)
- **Cache/Session**: Redis (ioredis) for session management and caching
- **Background Jobs**: Node-cron for scheduled tasks (subscription expiry reminders)
- **Error Tracking**: Sentry with source map support
- **Logging**: Pino with pretty-printing in development and rotating file streams in production
- **Authentication**: Session-based with bcrypt password hashing
- **External Integrations**: Email (Nodemailer), SMS (NetGSM), external web service API

The API exposes all endpoints under the `/trpc` prefix using tRPC routers. The application supports multiple companies per user with role-based access control via "page roles" (permission modules).

## Key Commands

### Development
```bash
npm run dev              # Start dev server (auto-reload with tsx watch)
npm run dev:debug       # Start dev server with Node debugger (--inspect-brk)
npm run lint            # Run ESLint with TypeScript support
npm run format          # Format code with Prettier (writes to src/)
```

### Database
```bash
npm run drizzle:generate    # Generate migration files from schema changes
npm run drizzle:migrate     # Run pending migrations
npm run drizzle:studio      # Open Drizzle Studio for visual DB inspection
npm run drizzle:migrate:with-ts  # Run migrations with TypeScript imports (in scripts/)
```

### Production & Build
```bash
npm run build           # Compile TypeScript + inject Sentry source maps
npm run start           # Run compiled server (dist/index.js)
npm run start:prod      # Alternative: run bundled version (dist/bundle.js)
npm run sentry:sourcemaps  # Inject and upload source maps to Sentry (called by build)
```

## Architecture & Code Structure

### Entry Point & Plugin Registration
- **`src/index.ts`**: Main server initialization
  - Registers Fastify plugins (CORS, compression, session, multipart, tRPC)
  - Sets up Redis session store with 24h TTL
  - Registers the file router at `/upload`
  - Registers tRPC plugin at `/trpc` with error handling and Sentry integration
  - Schedules cron job for subscription reminders (daily at 5 AM)
  - Configures logging (Pino pretty in dev, rotating streams in prod)

### tRPC API Layer
- **`src/trpc/`**: tRPC server setup
  - **`router/index.ts`**: Main app router combining all sub-routers
  - **`context.ts`**: Creates context from Fastify request/response (used in all procedures)
  - **`router/*.ts`** (18 routers): Feature-specific implementations
    - `auth.ts`: Login, logout, password reset, 2FA flow, device key management
    - `user.ts`: CRUD with pagination, sorting, search, company assignments
    - `company.ts`: CRUD with web service credentials, selected company session management
    - `subscription.ts` / `subscription-customer.ts`: Subscription lifecycle with expiry tracking
    - `debtor.ts` / `creditor.ts`: External web service integration (SIS)
    - `report.ts`: Business reporting with period filtering
    - `definition.ts`, `contract.ts`, `stock.ts`, `order.ts`, `waybill.ts`, `ticket.ts`: Domain features
    - `page-role.ts`: Admin permission module management
    - `event-log.ts`: Paginated audit log retrieval (`getEventLogs`)

### Database Layer
- **`src/db/`**: Drizzle ORM setup
  - **`schema/`**: 17 table definitions using Drizzle's declarative syntax
    - Core tables: `users`, `companies`, `subscriptions`, `subscription-customers`
    - Junction tables: `user-company`, `user-page-role`, `subscription-customer-junction`
    - Feature tables: `contracts`, `definitions`, `page-role`, `tickets`, `ticketMessages`, `event-log`, etc.
  - **Relations**: Many-to-many relationships defined in `schema/relations.ts`
  - Migrations auto-generated to `drizzle/` directory (checked into git)

### Services & Business Logic
- **`src/services/`**: Reusable service layer
  - **`jobs/subscription-reminder.ts`**: Batch job that runs daily, sends email/SMS notifications for subscriptions expiring in 7, 15, 30 days
  - **`zod-validations/`**: Zod schemas for input validation (user, subscription, contract, etc.) - used in routers
  - **`web-service/`**: External API integration (SIS system)
  - **`redis.ts`**: Redis client setup with getter/setter (initialized in onReady hook)
  - **`logger.ts`**: Pino logger singleton (Sentry-aware in production)
  - **`netgsm.ts`**: NetGSM SMS service wrapper
  - **`companiesDb.ts`**: Company-related database queries
  - **`page-roles.ts`**: Permission module logic
  - **`credit-count-emitter.ts`**: Real-time credit data updates

### Utilities & Configuration
- **`src/utils/`**: Helper functions
  - `auth.ts`: Session user validation, password reset token generation
  - `web-service.ts`: External API request wrapper with session authentication
  - `send-email.ts`: Email service wrapper (SMTP configuration)
  - `file.ts`: File upload/conversion handlers (PDF to PNG, image optimization with Sharp)
  - `parsing.ts`: Data transformation utilities
  - `crypto.ts`: Cryptographic operations
  - `event-log.ts`: `logEvent(params | params[])` — fire-and-forget audit log helper
- **`src/config/env.ts`**: Environment validation with Zod (strict schema, all env vars parsed at startup)
- **`src/constants/`**: App-wide constants (auth, messages, pagination, page roles)
- **`src/types/`**: TypeScript type definitions and DTOs

### Router for File Uploads
- **`src/router/file.ts`**: Fastify route handler for file uploads (not a tRPC endpoint)
  - Serves `/upload` endpoint for multipart file handling

## Important Patterns & Conventions

### Authorization & Sessions
- All procedures use `authorizedProcedure` (defined in `src/trpc/index.ts`) which checks session validity
- Session data includes: `userId`, `selectedCompanyId`, `externalSessionId` (for web service auth)
- Password hashing uses bcrypt with 10 salt rounds (`src/constants/auth.ts`)

### Database Queries
- Drizzle ORM is used for type-safe queries
- Common patterns: pagination with `offset()` and `limit()`, sorting with conditional `asc()`/`desc()`, searching with `ilike()` for LIKE queries
- Many routers fetch related data (e.g., user-to-company mappings) via separate joins for flexibility

### Input Validation
- All tRPC inputs use Zod schemas (defined in `src/services/zod-validations/`)
- Reusable validation schemas across mutations and queries
- Type inference: `input: z.infer<typeof SomeSchema>`

### Event Logging (Audit Log)
- Call `logEvent(params)` from `src/utils/event-log.ts` inside mutations after the operation succeeds
- All `resourceType` and `action` strings are in Turkish so the client can render human-readable sentences directly
- `logEvent` is fire-and-forget (errors are silently swallowed) — never `await` it
- For bulk deletes, pass an array to log one entry per deleted resource
- Auth failures (wrong password, expired/wrong OTP) are also logged with `status: 'başarısız'`

### Sentry Integration (Production Only)
- Imported as `import * as Sentry from '@sentry/node'`
- Initialized in `src/instrument.ts` (imported before app code)
- tRPC error handler captures errors with `path` and `tags` context
- Source maps automatically injected during build and uploaded to Sentry

### Logging
- Use `fastify.log` in route handlers or scheduled jobs
- In services without direct fastify access, use `getLogger()` from `src/services/logger.ts`
- In production: logs written to `logs/server.log` with daily rotation and gzip compression

### External Web Service Integration
- Company credentials stored in DB: `webServiceSource` (URL), `webServiceUsername`, `apiKey`, `apiSecret`
- Session-based auth: first call logs into external service, stores `externalSessionId` in session
- All subsequent requests use this session ID (`src/utils/web-service.ts` handles this)
- Debtor/Creditor endpoints fetch data from external SIS system

### Email & SMS
- Email via Nodemailer (SMTP) - `src/utils/send-email.ts`
- SMS via NetGSM REST API - `src/services/netgsm.ts`
- Subscription reminder job (`src/services/jobs/subscription-reminder.ts`) sends both based on customer preferences

### File Handling
- Multipart uploads limited to 10MB per file, 1 file per request
- PDF to PNG conversion using `pdf-to-png-converter`
- Image optimization with Sharp (resize, format conversion)
- Uploads stored in `files/` directory (git-ignored except directory structure)

## Configuration & Environment

### Required Environment Variables
```
NODE_ENV=development|production|test
PORT=3000 (default)
CORS_ORIGIN=http://localhost:5173 (or specific domain)
REDIS_URI=redis://... (required, includes auth)
SESSION_KEY=<base64-encoded 32+ byte key> (required)
DB_HOST, DB_USER, DB_PASS, DB_NAME (PostgreSQL)
SMTP_USER (email), SMTP_PASS (email)
NETGSM_HEADER, NETGSM_USERNAME, NETGSM_PASSWORD (SMS)
SENTRY_DSN (optional, for error tracking)
FAKE_2FA=true (development only, blocked in production for security)
```

All environment variables are validated at startup via `src/config/env.ts` using Zod.

## Code Quality

### ESLint & TypeScript
- **ESLint Config**: `eslint.config.ts` using new flat config format (ESLint 9)
- **TypeScript Config**: `tsconfig.json` targets ES2023, strict mode enabled
  - Source maps enabled for Sentry
  - `sourceRoot: "/"` to strip build paths in error reports
- **Prettier**: Semicolons enabled, single quotes, 100 char line width, arrow parens always
- **EditorConfig**: Enforces 2-space indents, LF line endings, UTF-8 charset

Rules enforced:
- `@typescript-eslint/no-floating-promises`: All promises must be awaited or handled
- `@typescript-eslint/prefer-promise-reject-errors`: off (allows Error objects in rejections)

### Cursor Rules (`.cursor/rules/rules.mdc`)
Sentry logging guidelines:
- Use `Sentry.logger.fmt` for structured logs with template literals
- Import Sentry as `import * as Sentry from "@sentry/node"`
- Enable `enableLogs: true` in Sentry.init() and use `consoleLoggingIntegration` to auto-capture console calls

## Development Workflow

### Starting Development
1. `npm install` (install dependencies)
2. Set up `.env` with PostgreSQL, Redis, SMTP, NetGSM, and Sentry credentials
3. `npm run drizzle:migrate` (run database migrations)
4. `npm run dev` (start API server)

### Making Database Changes
1. Edit schema files in `src/db/schema/`
2. `npm run drizzle:generate` (creates migration file)
3. Review the generated migration in `drizzle/`
4. `npm run drizzle:migrate` (apply to local DB)
5. Commit both schema changes and migration file

### Adding New API Endpoints
1. Create Zod schema in `src/services/zod-validations/` (if needed)
2. Add new router in `src/trpc/router/feature.ts` using `authorizedProcedure`
3. Import and register in `src/trpc/router/index.ts`
4. Use `createContext` to access `req` and `res` if needed

### Testing Locally
- Use Drizzle Studio: `npm run drizzle:studio` to inspect/modify DB
- Test tRPC endpoints via `http://localhost:3000/trpc/[router].[procedure]` with HTTP POST
- Check logs in console (dev) or `logs/server.log` (production)

## Performance Considerations

- Database queries use indexes (defined in schema)
- tRPC serialization uses SuperJSON for extended types (Date, Map, Set, etc.)
- Gzip compression enabled globally on all responses
- File upload is limited to prevent abuse
- Cron job for subscription reminders runs once daily (5 AM) to avoid constant polling

## Deployment

Build produces `dist/` directory with compiled JavaScript and source maps.

```bash
npm run build  # Compiles TS, injects Sentry source maps, uploads to Sentry
npm start      # Runs dist/index.js
```

Logs in production are rotated daily with 14-day retention and gzip compression.
