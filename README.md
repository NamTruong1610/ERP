# DentaCore

A full-stack dental clinic management system (patients, appointments, treatments, invoicing, and payments) built for a single, pre-launch, cash-pay-first clinic. Architectural decisions throughout favor pragmatism over premature scale — soft-deletes and audit logging are used deliberately where they carry real accounting/legal weight, and skipped where they'd just be overhead.

## Tech stack

**Backend:** Node.js, Express, PostgreSQL, Prisma v7 (via `@prisma/adapter-pg`), Redis (sessions, MFA/activation state), Cloudflare R2 (file storage, S3-compatible API), Resend (transactional email), node-cron (scheduled cleanup jobs).

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

The frontend mirrors this with a small `api/*.js` layer (one file per domain: `auth`, `clinic`, `invoice`, `admin`, `files`, `system`, `activation`, `user`) that all page components call through — no component talks to `axios` directly.

## Features

- **Auth** — account activation (set password → configure 2FA → verify OTP), login with mandatory TOTP 2FA and optional "remember me", password reset via email, email change with re-verification, Redis-backed cooldowns to prevent resend spam.
- **RBAC** — three roles (`STAFF` < `ADMIN` < `SUPER_ADMIN`), each inheriting every permission of the tier below plus its own. Centralized in `RBACConfig.js`.
- **Patients** — CRUD, soft-delete, file attachments (X-rays, PDFs, DICOM) stored in R2, appointment history.
- **Appointments** — scheduling, dentist assignment, status lifecycle (`SCHEDULED` → `COMPLETED` / `CANCELLED`).
- **Treatments** — recorded 1:1 against a completed appointment; feed into invoicing.
- **Invoicing** — draft → issue → paid/void lifecycle. Line items optionally link 1:1 to a treatment. Subtotal/discount/tax/total are always computed server-side (never trust client-submitted totals).
- **Payments** — manual payment recording with per-item allocation (a payment can be split across multiple invoice items), reversal via void (not deletion — corrections are new events, not edits to history), automatic invoice/item status recomputation, full per-invoice payment ledger.
- **Files** — presigned direct-to-R2 upload/download, soft-delete + restore + purge, with an automated daily job permanently purging files past their retention window.
- **Audit log** — every state-changing action is recorded (actor, target, action, metadata, IP, user agent) in the same transaction as the operation it documents, so a crash mid-operation can never produce an action without a corresponding log entry (or vice versa).
- **Admin tools** — user suspend/reactivate, force logout, resend activation, reset 2FA, role assignment; session management; audit log viewer; soft-deleted user recovery.
- **Scheduled jobs** (`node-cron`) — hourly cleanup of expired unactivated accounts, startup cleanup of stale pending uploads, daily purge of soft-deleted files.

## Getting started

### Prerequisites

- Node.js and npm
- A PostgreSQL database
- A Redis instance
- A Cloudflare R2 bucket (or any S3-compatible equivalent)
- A Resend account for transactional email

### Environment variables

Set these in a `.env` file in the backend project root — the server refuses to start if any are missing (`validateEnv.js`):

| Variable              | Purpose                                             |
|------------------------|------------------------------------------------------|
| `DATABASE_URL`         | PostgreSQL connection string                         |
| `REDIS_URL`            | Redis connection string                              |
| `RESEND_API_KEY`       | Transactional email (activation, password reset, etc.) |
| `CLIENT_URL`           | Frontend origin, used to build links in emails       |
| `R2_ENDPOINT`          | Cloudflare R2 (or S3-compatible) endpoint            |
| `R2_ACCESS_KEY_ID`     | R2 access key                                        |
| `R2_SECRET_ACCESS_KEY` | R2 secret key                                        |
| `R2_BUCKET_NAME`       | R2 bucket name                                       |
| `CLINIC_TIMEZONE`      | Clinic's local timezone, for date/time handling      |

Optional, with defaults:

| Variable   | Default | Purpose                                  |
|------------|---------|-------------------------------------------|
| `PORT`     | `5500`  | Server port                               |
| `TAX`      | `0`     | Invoice tax rate applied to every invoice |
| `DISCOUNT` | `0`     | Invoice discount rate applied to every invoice |

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
- runs each cleanup job once immediately, then
- schedules them to run on a recurring basis (hourly expired-account cleanup, daily soft-deleted-file purge).

### Frontend setup

```bash
cd <frontend-directory>
npm install
npm run dev
```

### Default seeded accounts (development only)

The server seeds two accounts on startup if they don't already exist:

| Email                        | Password | Roles                         | 2FA      |
|-------------------------------|----------|--------------------------------|----------|
| `test1@gmail.com`              | `123456` | `ADMIN`, `STAFF`               | disabled |
| `superadmin@dentacore.local`   | `123456` | `SUPER_ADMIN`, `ADMIN`, `STAFF` | enabled — TOTP secret printed to the console on first boot |

> **Note:** the console output for the super admin currently prints `SuperAdmin123!` as the password — that's stale/incorrect. The password actually seeded (and hashed) is `123456`, as shown above. Worth fixing `seedUtils.js` so the log matches reality. Never use these seeded credentials outside local development.

## API overview

All routes are mounted under `/api/v2`:

| Path              | Covers                                      |
|--------------------|----------------------------------------------|
| `/auth`            | Login, logout, MFA verification, password reset |
| `/activate`        | Account activation flow (set password, 2FA setup/verify) |
| `/user`            | Self-service profile (name, phones, addresses, password, email, 2FA) |
| `/admin`           | User management (admin/super-admin only)     |
| `/patients`        | Patient records                              |
| `/appointments`    | Appointment scheduling                       |
| `/treatments`      | Treatment records                            |
| `/invoices`        | Invoice lifecycle and line items             |
| `/payments`        | Payment recording, ledger, void               |
| `/files`           | Patient file upload/download/delete/purge     |
| `/stats`           | Dashboard stats (personal, clinic, system tiers) |
| `/system`          | Audit log, sessions, deleted-user recovery (super admin only) |

## Architectural conventions

If you're contributing, these are the load-bearing conventions to follow rather than reinvent:

- **Prisma schema is the source of truth.** After any schema change, run `npx prisma generate` and apply a migration (or `db push`). A stale, unregenerated client silently returns `undefined` for new fields rather than erroring loudly — this has been a recurring source of bugs.
- **Soft-delete by default** for any record with external footprint (patients, appointments, invoices, files). **Hard-delete** is reserved for records with zero audit/accounting implications (e.g. a line item on a still-draft invoice).
- **Write-ahead audit logging.** The audit log entry is written inside the same database transaction as the operation it documents — never logged before the operation is confirmed to succeed, never skipped for a successful operation.
- **Reversal over deletion for anything financial.** Payments are immutable once created. Corrections happen via an explicit void (a new event), never by editing or deleting history.
- **Application-layer uniqueness enforcement** where a business rule needs flexibility a raw DB constraint can't express (in addition to, not instead of, DB constraints where they're a good fit).
- **RBAC permissions are additive by tier:** `SUPER_ADMIN` ⊃ `ADMIN` ⊃ `STAFF`. New permissions get added to `RBACConfig.js` and assigned to the appropriate tier(s) — never checked ad hoc in a controller.

## Known limitations / open work

- **Void-and-rebill gap** — voiding an invoice doesn't release its items' treatment links, so a treatment on a voided invoice can't be added to a new invoice until that's done manually.
- **No distinct refund flow** — void is currently the only payment-reversal path. A `PAYMENTS_REFUND` permission exists in `RBACConfig.js` for when this is built out as its own flow.
- **`OVERDUE` invoice status isn't cron-driven yet** — nothing currently transitions an invoice to `OVERDUE` automatically based on `dueAt`.
- **No idempotency-key protection** on appointment/treatment/payment creation endpoints — a double-submit (network retry, double-click) can currently create duplicate records.
- **Stripe integration** is deferred — manual payment tracking was the priority to get stable first.
- **No automated test suite** exists yet.
- **Notification system** (e.g. emailing patients when an invoice is issued or overdue) hasn't been built.