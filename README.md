# DentaCore

A full-stack dental clinic management system (patients, appointments, clinical visits, treatment plans, invoicing, and payments) built for a single, pre-launch, cash-and-card-pay clinic. Architectural decisions throughout favor pragmatism over premature scale — soft-deletes and audit logging are used deliberately where they carry real accounting/legal weight, and skipped where they'd just be overhead.

## Tech stack

**Backend:** Node.js, Express, PostgreSQL, Prisma v7 (via `@prisma/adapter-pg`), Redis (sessions, MFA/activation state, distributed cron locks), RabbitMQ (all background job queues — email, maintenance, webhook processing), Cloudflare R2 (file storage, S3-compatible API), Resend (transactional email), Stripe (payment-link checkout), node-cron (scheduled jobs).

**Frontend:** React, Vite, React Router, Axios. No CSS framework — a small hand-written design system (`global.css`) with CSS custom properties for theming.

## Architecture

Layered/n-tier structure on the backend:

```
Routes → Middleware (auth, RBAC, validation) → Controllers → Services → Repositories → Prisma
```

- **Routes** wire up `requireAuth`, `requirePermission(PERMISSIONS.X)`, and `express-validator` chains before handing off to a controller.
- **Controllers** are thin — parse `req`, call a service, shape the response, map `AppError` to an HTTP status.
- **Services** hold business rules (what's allowed, what state transitions are valid) and own transaction boundaries.
- **Repositories** are the only layer that talks to Prisma directly.
- **Queues/Workers** — RabbitMQ queues (`emails`, `maintenance`, `webhook`), each with a DLX-backed retry ladder (main → per-attempt retry queue → back to main, or to a `.failed` queue once attempts are exhausted). A dedicated cron job (`checkWebhookDlqDepthService`) monitors the webhook failed-queue depth.

The frontend mirrors this with a small `api/*.js` layer (one file per domain: `auth`, `clinic`, `invoice`, `admin`, `files`, `system`, `activation`, `user`) that all page components call through — no component talks to `axios` directly.

## Features

- **Auth** — account activation (set password → configure 2FA → verify OTP), login with mandatory TOTP 2FA and optional "remember me", password reset via email, email change with re-verification, Redis-backed cooldowns to prevent resend spam.
- **RBAC** — three roles (`STAFF` < `ADMIN` < `SUPER_ADMIN`), each inheriting every permission of the tier below plus its own. Centralized in `RBACConfig.js`.
- **Patients** — CRUD, soft-delete, file attachments (X-rays, PDFs, DICOM) stored in R2, appointment history.
- **Appointments** — scheduling, dentist assignment, status lifecycle (`SCHEDULED` → `COMPLETED` / `CANCELLED`).
- **Visits** — the clinical record, decoupled from scheduling: a `Visit` can originate from an appointment or be a walk-in (`appointmentId` is nullable), can carry multiple providers (primary/assisting/hygienist/other), and can carry multiple `Treatment`s. Completing a visit auto-completes its linked appointment, if any.
- **Treatment plans** — a `TreatmentPlan` groups treatments performed across multiple visits/days toward one case, with proposal-style `TreatmentPlanItem` cost-estimate lines that later convert into real `Treatment` records (deliberately no accept/decline workflow — out of scope by design).
- **Procedure catalog** — reusable procedure definitions (code, name, category, default amount) that treatments and plan items can reference.
- **Invoicing** — draft → issue → paid/void lifecycle. Line items optionally link 1:1 to a treatment. Subtotal/discount/tax/total are always computed server-side (never trust client-submitted totals).
- **Payments** — two paths into the same ledger:
  - *Manual* — staff-recorded payment with per-item allocation (a payment can be split across multiple invoice items), reversal via void (not deletion — corrections are new events, not edits to history), automatic invoice/item status recomputation.
  - *Stripe Checkout* — a `PaymentAttempt` bridges "link generated" → "payment confirmed" (`PENDING` / `COMPLETED` / `FAILED` / `EXPIRED` / `CANCELLED`), with a server-generated idempotency key persisted before any Stripe call, webhook-driven confirmation (`WebhookEvent` dedup on `[provider, externalEventId]`), and a 10-minute reconciliation cron that queries Stripe directly for stale `PENDING` attempts as a safety net.
  - Full per-invoice payment ledger regardless of path.
- **Files** — presigned direct-to-R2 upload/download, soft-delete + restore + purge, with an automated daily job permanently purging files past their retention window.
- **Audit log** — every state-changing action is recorded (actor, target, action, metadata, IP, user agent) in the same transaction as the operation it documents, so a crash mid-operation can never produce an action without a corresponding log entry (or vice versa).
- **Admin tools** — user suspend/reactivate, force logout, resend activation, reset 2FA, role assignment; session management; audit log viewer; soft-deleted user recovery.
- **Scheduled jobs** (`node-cron`, coordinated across instances via a Redis `SET NX` lock) — hourly cleanup of expired unactivated accounts, startup cleanup of stale pending uploads, daily purge of soft-deleted files, 10-minute stale-payment-attempt reconciliation, 10-minute webhook dead-letter-queue depth check.

## Known limitations / open work

- **Void-and-rebill gap** — voiding an invoice doesn't release its items' treatment links, so a treatment on a voided invoice can't be added to a new invoice until that's done manually.
- **No distinct refund flow** — void is currently the only payment-reversal path. A `PAYMENTS_REFUND` permission exists in `RBACConfig.js` for when this is built out as its own flow.
- **`OVERDUE` invoice status isn't cron-driven yet** — nothing currently transitions an invoice to `OVERDUE` automatically based on `dueAt`.
- **No idempotency-key protection on direct-create endpoints** — appointment, treatment, and manual-payment creation can still be double-submitted (network retry, double-click) into duplicate records. (Stripe checkout payments are already covered via `PaymentAttempt.idempotencyKey`.)
- **No automated test suite** exists yet (`server`'s `test` script is still the default placeholder).
- **Notification system** — no patient-facing emails yet for invoice issued/overdue, appointment reminders, etc. Only account-lifecycle emails (activation, password reset, email change) exist today.
- **Auth service extraction** — not started. Currently a single Express app; a dedicated `auth.dentacore.app` broker (short-lived auth-code handoff, Redis pub/sub back-channel logout) is planned for when a second relying party (e.g. an analytics app) exists.
- **Stray dependency** — `server/package.json` lists `mongoose`, which isn't used anywhere in a Prisma/Postgres codebase; worth pruning.

## Getting started

### Prerequisites

- Node.js and npm
- A PostgreSQL database
- A Redis instance
- A RabbitMQ instance
- A Cloudflare R2 bucket (or any S3-compatible equivalent)
- A Resend account for transactional email
- A Stripe account (test mode is fine) for payment-link checkout

`docker-compose.yml` can provide Postgres + Redis + RabbitMQ locally (`docker compose up`); run `api`/`client` natively on the host for day-to-day dev, or add `--profile full` to run everything in containers.

### Environment variables

Set these in a `.env` file in the backend project root — the server refuses to start if any are missing (`validateEnv.js`):

| Variable                | Purpose                                                |
|--------------------------|----------------------------------------------------------|
| `DATABASE_URL`           | PostgreSQL connection string                             |
| `REDIS_URL`              | Redis connection string                                  |
| `RABBITMQ_URL`           | RabbitMQ connection string                                |
| `RESEND_API_KEY`         | Transactional email (activation, password reset, etc.)   |
| `CLIENT_URL`             | Frontend origin, used to build links in emails           |
| `R2_ENDPOINT`            | Cloudflare R2 (or S3-compatible) endpoint                 |
| `R2_ACCESS_KEY_ID`       | R2 access key                                              |
| `R2_SECRET_ACCESS_KEY`   | R2 secret key                                              |
| `R2_BUCKET_NAME`         | R2 bucket name                                             |
| `CLINIC_TIMEZONE`        | Clinic's local timezone, for date/time handling            |
| `STRIPE_SECRET_KEY`      | Stripe secret key, for Checkout Session creation and webhook processing |

Optional, with defaults:

| Variable   | Default | Purpose                                        |
|------------|---------|--------------------------------------------------|
| `PORT`     | `5500`  | Server port                                       |
| `TAX`      | `0`     | Invoice tax rate applied to every invoice         |
| `DISCOUNT` | `0`     | Invoice discount rate applied to every invoice    |

### Backend setup

```bash
cd server
npm install

npx prisma generate
npx prisma migrate dev   # or `npx prisma db push` for a quick sync without migration history

npm start
```

On first boot the server automatically:
- seeds two development accounts (see below),
- connects to RabbitMQ and starts the email/maintenance/webhook workers,
- runs each cleanup/reconciliation job once immediately, then schedules them on their recurring cadence (see Scheduled jobs above).

For local webhook testing, use the Stripe CLI to forward events to `/api/webhooks/stripe`.

### Frontend setup

```bash
cd client
npm install
npm run dev
```

### Default seeded accounts (development only)

The server seeds two accounts on startup if they don't already exist:

| Email                        | Password | Roles                          | 2FA      |
|-------------------------------|----------|----------------------------------|----------|
| `test1@gmail.com`              | `123456` | `ADMIN`, `STAFF`                 | disabled |
| `superadmin@dentacore.local`   | `123456` | `SUPER_ADMIN`, `ADMIN`, `STAFF`  | enabled — TOTP secret printed to the console on first boot |

> **Known doc/log bug:** the console output for the super admin currently prints `SuperAdmin123!` as the password — that's stale. The password actually seeded (and hashed) is `123456`, as shown above. Worth fixing the log line in `seedUtils.js` so it matches reality. Never use these seeded credentials outside local development.

## RBAC conventions

- **RBAC permissions are additive by tier:** `SUPER_ADMIN` ⊃ `ADMIN` ⊃ `STAFF`. New permissions get added to `RBACConfig.js` and assigned to the appropriate tier(s) — never checked ad hoc in a controller.