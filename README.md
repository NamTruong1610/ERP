# DentaCore — Dental Clinic ERP System

## Table of Contents

1. [Project Overview](#project-overview)
2. [Getting Started](#getting-started)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Backend Architecture](#backend-architecture)
   - [Entry Point](#entry-point)
   - [Configuration](#configuration)
   - [Database](#database)
   - [Redis](#redis)
   - [Authentication & Session Management](#authentication--session-management)
   - [Middleware](#middleware)
   - [Routes](#routes)
   - [Controllers](#controllers)
   - [Services](#services)
   - [Utilities](#utilities)
6. [Frontend Architecture](#frontend-architecture)
   - [Project Setup](#project-setup)
   - [Auth Context & Route Guards](#auth-context--route-guards)
   - [Pages](#pages)
   - [API Layer](#api-layer)
7. [Security Architecture](#security-architecture)
8. [Data Flow](#data-flow)
9. [Environment Variables](#environment-variables)

---

## Project Overview

Dental clinics traditionally manage patient records, appointment schedules, and treatment histories using paper files or disconnected spreadsheets. This leads to lost records, scheduling conflicts, and no centralised view of a patient's history across visits.

DentaCore solves that by providing a centralised digital platform where:

- **Dentists** can view the full appointment schedule, record treatments after each visit, and access a patient's complete history
- **Administrators** can manage staff accounts, control access permissions, schedule appointments, and oversee the entire clinic's operations
- **Patients** are registered once and their history — every appointment, procedure, and cost — is tracked automatically over time

Built as a full-stack monorepo with a Node.js/Express backend and a React/Vite frontend, the system includes enterprise-grade security: multi-factor authentication, role-based access control, rotating session tokens, and automated account lifecycle management.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) v14+
- [Redis](https://redis.io/)
- A [Resend](https://resend.com) account for transactional emails

### Backend Setup

```bash
cd server

# Install dependencies
npm install

# Create your .env file (see Environment Variables section)
cp .env.example .env

# Run database migrations
npx prisma generate
npx prisma migrate dev

# Start the server
npm run dev
```

The backend runs on `http://localhost:5500`.

### Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend runs on `http://localhost:5173`.

### First Login

A default admin account is seeded automatically on first server start:

- **Email:** `admin@erp.com`
- **Password:** `Admin@123`

Change this password immediately after first login.

---

## Tech Stack

### Backend

| Technology | Purpose |
| --- | --- |
| Node.js + Express | HTTP server and routing |
| PostgreSQL | Primary relational database |
| Prisma v7 | ORM and database client |
| Redis | Session storage, token management, TTL-based cleanup |
| bcrypt | Password hashing |
| speakeasy | TOTP-based MFA (Google Authenticator compatible) |
| qrcode | Server-side QR code generation for MFA setup |
| Resend | Transactional email delivery |
| helmet | HTTP security headers |
| cookie-parser | Cookie parsing middleware |
| node-cron | Scheduled cleanup of expired user accounts |

### Frontend

| Technology | Purpose |
| --- | --- |
| React 18 | UI component framework |
| Vite | Build tool and dev server |
| React Router v6 | Client-side routing |
| Axios | HTTP client with interceptors |
| React Context API | Global auth state management |
| Tabler Icons | Icon webfont |

---

## Project Structure

```
/
├── server/                          # Backend
│   ├── index.js                     # Entry point, bootstrap, seeding, cron jobs
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   ├── prisma.config.ts         # Prisma configuration
│   │   └── migrations/              # Migration history
│   ├── config/
│   │   ├── AppConfig.js             # Express setup, middleware, route mounting
│   │   ├── PrismaConfig.js          # Prisma client with pg adapter
│   │   ├── RedisConfig.js           # Redis client
│   │   └── RBACConfig.js            # Roles and permissions definitions
│   ├── controllers/
│   │   ├── activationControllers.js
│   │   ├── authControllers.js
│   │   ├── userControllers.js
│   │   ├── adminControllers.js
│   │   ├── patientControllers.js
│   │   ├── appointmentControllers.js
│   │   └── treatmentControllers.js
│   ├── middlewares/
│   │   ├── authMiddleware.js        # Session validation (requireAuth)
│   │   └── rbacMiddleware.js        # Permission checking (requirePermission)
│   ├── routes/
│   │   ├── activationRoutes.js
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── patientRoutes.js
│   │   ├── appointmentRoutes.js
│   │   └── treatmentRoutes.js
│   ├── services/
│   │   ├── userService.js
│   │   ├── patientService.js
│   │   ├── appointmentService.js
│   │   └── treatmentService.js
│   └── utils/
│       ├── activationTokenUtils.js
│       ├── passwordUtils.js
│       ├── mfaUtils.js
│       ├── emailUtils.js
│       └── cleanupUtils.js
│
└── client/                          # Frontend
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx                 # AuthProvider mounted here, outside BrowserRouter
        ├── App.jsx                  # All routes
        ├── styles/
        │   └── global.css           # Single design system CSS file
        ├── api/
        │   ├── axiosInstance.js     # Axios config, interceptors, retry + redirect guard
        │   ├── activation.js
        │   ├── auth.js
        │   ├── user.js
        │   ├── admin.js
        │   └── clinic.js            # Patients, appointments, treatments
        ├── context/
        │   ├── AuthContext.js
        │   ├── AuthProvider.jsx
        │   └── useAuth.js
        ├── components/
        │   ├── ProtectedRoute.jsx
        │   └── AppSidebar.jsx
        └── pages/
            ├── auth/
            ├── home/
            ├── profile/
            ├── admin/
            └── clinic/
```

---

## Backend Architecture

### Entry Point

`index.js` bootstraps in this order:

1. Connect to PostgreSQL via Prisma
2. Connect to Redis
3. Seed admin user if not present
4. Start Express server
5. Run immediate expired account cleanup, then schedule hourly cron job

```javascript
await prismaConnect()
await redisConnect()
await seedAdminUser()
await appConfig(app)
await cleanupExpiredUsers()
cron.schedule('0 * * * *', async () => { await cleanupExpiredUsers() })
```

---

### Configuration

**`AppConfig.js`** mounts all route groups:

```
/api/v2/activate      → activationRoutes
/api/v2/auth          → authRoutes
/api/v2/user          → userRoutes
/api/v2/admin         → adminRoutes
/api/v2/patients      → patientRoutes
/api/v2/appointments  → appointmentRoutes
/api/v2/treatments    → treatmentRoutes
```

**`PrismaConfig.js`** creates the Prisma client using `@prisma/adapter-pg`:

```javascript
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
```

**`RBACConfig.js`** defines all permissions and role assignments statically:

```javascript
PERMISSIONS = {
  PROFILE_READ, PROFILE_UPDATE, PROFILE_PASSWORD_CHANGE,
  PROFILE_EMAIL_CHANGE, PROFILE_PHONES_MANAGE, PROFILE_ADDRESSES_MANAGE,
  USERS_READ, USERS_CREATE, USERS_UPDATE, USERS_DELETE,
  USERS_SUSPEND, USERS_REACTIVATE, USERS_FORCE_LOGOUT,
  USERS_RESEND_ACTIVATION, USERS_RESET_2FA, USERS_ROLES_MANAGE,
  PATIENTS_READ, PATIENTS_CREATE, PATIENTS_UPDATE, PATIENTS_DELETE,
  APPOINTMENTS_READ, APPOINTMENTS_READ_ALL, APPOINTMENTS_CREATE,
  APPOINTMENTS_UPDATE, APPOINTMENTS_DELETE,
  TREATMENTS_READ, TREATMENTS_READ_ALL, TREATMENTS_CREATE,
  TREATMENTS_UPDATE, TREATMENTS_DELETE
}

ROLES = {
  STAFF: [ ...profile permissions + clinic permissions including APPOINTMENTS_READ_ALL ],
  ADMIN: [ ...all permissions ]
}
```

---

### Database

PostgreSQL accessed via Prisma ORM. Six tables:

**`User`** — Dentist/staff accounts

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `email` | String | Unique |
| `password` | String? | bcrypt hashed |
| `activationTokenId` | String? | Hashed, unique |
| `status` | String | `PENDING_ACTIVATION` → `PENDING_MFA_SETUP` → `PENDING_MFA_VERIFICATION` → `ACTIVE` |
| `roles` | String[] | Default: `["STAFF"]` |
| `phones` | String[] | |
| `mfaSecret` | String? | TOTP secret |
| `mfaUri` | String? | otpauth URL stored for QR regeneration |
| `mfaEnabled` | Boolean | |
| `expiresAt` | DateTime? | Null for permanent accounts |

**`UserName`** — One-to-one with User (cascade delete). Stores `fName`, `mName`, `lName` separately to allow independent updates.

**`Address`** — One-to-many with User (cascade delete). Each address has its own row with `street`, `suburb`, `post`, `city`.

**`Patient`** — Dental clinic patients

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `firstName` | String | |
| `lastName` | String | |
| `dob` | DateTime | Date of birth |
| `gender` | String | |
| `phone` | String? | |
| `email` | String? | |
| `address` | String? | |

**`Appointment`** — Links dentist (User) to patient

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `dentistId` | String? | FK → User, `onDelete: SetNull` |
| `patientId` | String | FK → Patient |
| `date` | DateTime | |
| `status` | String | `SCHEDULED`, `COMPLETED`, `CANCELLED` |
| `notes` | String? | |

**`Treatment`** — One-to-one with Appointment (cascade delete)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `appointmentId` | String | Unique FK → Appointment, `onDelete: Cascade` |
| `procedure` | String | e.g. Filling, Extraction, Cleaning |
| `toothNumber` | Int? | 1–32 |
| `notes` | String? | |
| `cost` | Float | AUD |

**Entity Relationships:**

```
User (Dentist) ──── many ──── Appointment ──── one ──── Treatment
                                   │
Patient ────────── many ───────────┘
```

**Key cascade decisions:**
- Deleting a dentist user sets `dentistId` to null on their appointments (`SetNull`) — appointment history preserved
- Deleting an appointment cascades to its treatment (`Cascade`) — no orphaned treatment records
- Deleting a patient cascades to all their appointments and treatments

**TTL Strategy:** New users have `expiresAt` set to +48hrs. Hourly cron job deletes records where `expiresAt < now`. On activation completion, `expiresAt` is set to null.

---

### Redis

| Key Pattern | Type | TTL | Purpose |
| --- | --- | --- | --- |
| `session:{sessionId}` | String (JSON) | 30 mins | Active login session |
| `token:remember:{tokenId}` | String (JSON) | 7 days | Remember Me token |
| `token:mfa_login:{tokenId}` | String (JSON) | 5 mins | MFA login handshake |
| `token:recover:{tokenId}` | String (JSON) | 15 mins | Password recovery |
| `token:email_change:{tokenId}` | String (JSON) | 15 mins | Email change verification |
| `mfa:{userId}` | String | 10 mins | MFA setup handshake |
| `user_sessions:{userId}` | Sorted Set | — | Session ID registry (score = expiry timestamp) |
| `user_remember:{userId}` | Sorted Set | — | Remember token registry (score = expiry timestamp) |
| `user_mfa_login:{userId}` | String (JSON) | 6 mins | User → MFA login token map |
| `user_recover:{userId}` | String (JSON) | 16 mins | User → recovery token map |
| `user_email_change:{userId}` | String (JSON) | 16 mins | User → email change token map |

Sorted sets use expiry timestamps as scores, enabling lazy cleanup via `ZREMRANGEBYSCORE key 0 Date.now()` on every authenticated request. Redis automatically deletes empty sorted sets — a key disappearing after logout is expected behavior, not a bug.

---

### Authentication & Session Management

**Login (no MFA):** Validate credentials → generate `sessionId` → store in Redis with 30-min TTL → set `SESSIONID` httpOnly cookie

**Login (with MFA):** Validate credentials → generate `mfaLoginTokenId` → return to client → client submits OTP → validate → create session → set cookie

**Remember Me:** If checked at login, a `rememberTokenId` is stored in Redis (7 days) and set as a `REMEMBER` httpOnly cookie. On every authenticated request, if `SESSIONID` has expired but `REMEMBER` is valid, the token is rotated (old deleted, new created) and a new session is issued automatically.

**`GET /api/v2/auth/me`:** Lightweight session check. Returns `{ id, roles, email, name }`. Used by `AuthProvider` on mount — intentionally separate from `getProfile` to keep concerns distinct and the response minimal.

---

### Middleware

**`requireAuth`**: Validates `SESSIONID` cookie via Redis → fetches fresh user from PostgreSQL on every request (ensures immediate suspension enforcement) → sets `req.user`. Falls back to `REMEMBER` token rotation if session has expired.

**`requirePermission(permission)`**: Factory returning async middleware. Performs fresh PostgreSQL role lookup on every request — role changes take effect immediately without requiring re-login.

---

### Routes

```
POST   /api/v2/activate/password
POST   /api/v2/activate/mfa/secret
POST   /api/v2/activate/mfa/verify

GET    /api/v2/auth/me
POST   /api/v2/auth/login
POST   /api/v2/auth/login/mfa/verify
POST   /api/v2/auth/logout
POST   /api/v2/auth/logout/all
POST   /api/v2/auth/forgot-password
POST   /api/v2/auth/reset-password

GET    /api/v2/user/profile
PATCH  /api/v2/user/name
POST   /api/v2/user/phones
DELETE /api/v2/user/phones/:phone
POST   /api/v2/user/addresses
PATCH  /api/v2/user/addresses/:addressId
DELETE /api/v2/user/addresses/:addressId
POST   /api/v2/user/password
POST   /api/v2/user/email
POST   /api/v2/user/email/verify
POST   /api/v2/user/2fa/enable
POST   /api/v2/user/2fa/disable
GET    /api/v2/user/dentists

GET    /api/v2/admin/users
GET    /api/v2/admin/users/:id
POST   /api/v2/admin/users
PATCH  /api/v2/admin/users/:id
DELETE /api/v2/admin/users/:id
POST   /api/v2/admin/users/:id/suspend
POST   /api/v2/admin/users/:id/reactivate
POST   /api/v2/admin/users/:id/force-logout
POST   /api/v2/admin/users/:id/resend-activation
POST   /api/v2/admin/users/:id/reset-2fa
POST   /api/v2/admin/users/:id/roles
DELETE /api/v2/admin/users/:id/roles

GET    /api/v2/patients
GET    /api/v2/patients/:id
POST   /api/v2/patients
PATCH  /api/v2/patients/:id
DELETE /api/v2/patients/:id

GET    /api/v2/appointments
GET    /api/v2/appointments/me
GET    /api/v2/appointments/:id
GET    /api/v2/appointments/patient/:patientId
POST   /api/v2/appointments
PATCH  /api/v2/appointments/:id
DELETE /api/v2/appointments/:id

GET    /api/v2/treatments/:id
GET    /api/v2/treatments/appointment/:appointmentId
POST   /api/v2/treatments
PATCH  /api/v2/treatments/:id
DELETE /api/v2/treatments/:id
```

---

### Controllers

Controllers handle request validation, orchestrate service calls, and manage Redis operations. They never call Prisma directly.

**`activationControllers.js`**: Three-step account activation — set password, get MFA QR code, verify OTP. On completion, creates a session so the user is automatically logged in.

**`authControllers.js`**: Login, MFA login verification, logout (single device), logout all, forgot/reset password.

**`userControllers.js`**: Profile read/update, phone management, address CRUD, password change, email change with verification flow, MFA enable/disable.

**`adminControllers.js`**: User CRUD, suspend/reactivate, force logout, resend activation, reset 2FA (resends activation email so user re-enters setup flow), role management. Status changes only through dedicated controllers — `updateUserController` explicitly excludes status from allowed fields.

**`patientControllers.js`**: Patient CRUD.

**`appointmentControllers.js`**: Appointment CRUD. All staff see all appointments (`APPOINTMENTS_READ_ALL` assigned to STAFF role).

**`treatmentControllers.js`**: Treatment CRUD. Recording a treatment automatically sets the linked appointment to `COMPLETED`.

---

### Services

All Prisma queries live in service files. Controllers never call Prisma directly.

**`userService.js`**: User CRUD, role management, name/phone/address operations. `updateUser` handles nested name upsert — `UserName` is one-to-one so it upserts through the parent. Address operations target rows directly by `addressId` due to one-to-many cardinality.

**`patientService.js`**: Patient CRUD. `findPatientById` includes full appointment and treatment history.

**`appointmentService.js`**: Appointment CRUD with dentist/patient filtering. All queries include dentist (with name), patient, and treatment relations.

**`treatmentService.js`**: Treatment CRUD. All queries include full appointment with dentist and patient.

---

### Utilities

**`activationTokenUtils.js`**: Cryptographically random token generation via `crypto.randomBytes`. Only hashed versions stored in the database — raw token sent to user once via email.

**`passwordUtils.js`**: bcrypt hashing and comparison.

**`mfaUtils.js`**: speakeasy TOTP secret generation (`DentaCore` as issuer) and OTP verification with a 1-step window for clock drift tolerance.

**`emailUtils.js`**: Resend SDK wrapper. Three email types: account activation, password recovery, email change verification.

**`cleanupUtils.js`**: Deletes PostgreSQL user records where `expiresAt < now`. Replaces the MongoDB TTL index pattern.

---

## Frontend Architecture

### Project Setup

**`vite.config.js`**: Proxies `/api` requests from port 5173 → 5500, solving CORS in development.

**`axiosInstance.js`**:
- `baseURL: '/api/v2'`, `withCredentials: true`
- 401 interceptor retries the failed request once before redirecting — handles the remember me token rotation race condition where a new session cookie may not yet be available when a second concurrent request fires
- `isRedirecting` flag prevents duplicate redirects
- Public paths excluded from redirect: `/login`, `/activate`, `/forgot-password`, `/reset-password`

---

### Auth Context & Route Guards

**`AuthProvider.jsx`**:
- Mounted outside `BrowserRouter` in `main.jsx` — mounts once for the entire app lifetime
- Calls `GET /api/v2/auth/me` on mount. Returns `{ id, roles, email, name }` — enough for session validation and sidebar display without fetching the full profile
- Only clears `user` on 401 — a 500 error does not log the user out
- Exposes `user`, `loading`, `login()`, `logoutUser()`, `isAdmin()`, `refreshUser()`
- `refreshUser()` re-calls `getMe()` to sync the sidebar after profile name changes

**`AppSidebar.jsx`**: Shared sidebar across all authenticated pages. Shows user initials, name, and roles in the footer. Navigation sections: Main (Home, Profile), Clinic (Patients, Appointments), Admin (admin only), Session (Sign out). `active` prop highlights the current page.

**`ProtectedRoute`**: Redirects unauthenticated users to `/login`.

**`AdminRoute`**: Redirects non-admins to `/home`.

---

### Pages

**Activation** (`/activate` → `/activate/2fa` → `/activate/2fa/verify`):
Three-step flow. State (`activationToken`, `mfaToken`) passed between steps via React Router state. QR code generated server-side via `qrcode` package and returned as a base64 data URL. On successful OTP verification, user is redirected to `/login` to sign in with their new account.

**Auth**: Login → `/home` after `getMe()`. MFA login (`/login/mfa`). Forgot/reset password.

**Home** (`/home`): Personalised greeting with time-of-day, current date. Stat card placeholders ready for future dashboard data.

**Profile** (`/profile`): Sections for personal information, phones, addresses, password, email, and 2FA. Name updates call `refreshUser()` to sync the sidebar immediately. Password change invalidates all sessions and redirects to login. 2FA disable invalidates all sessions and redirects to login.

**Admin** (`/admin/users`, `/admin/users/:id`):
User list with search. Clicking own row redirects to `/profile`. User detail shows contextual actions based on status — Suspend (active users), Reactivate (suspended), Resend activation (pending), Reset 2FA (when `mfaSecret` exists). Self-deletion and self-suspension prevented on both frontend and backend. Status only changes through dedicated action endpoints — not the edit form.

**Clinic**:
- `Patients.jsx` / `PatientDetail.jsx` — Patient CRUD with appointment history table
- `Appointments.jsx` / `AppointmentDetail.jsx` — All staff see all appointments. Edit appointment (date, dentist, notes), cancel, record/edit treatment inline. Admins can delete any appointment regardless of status. Deleting an appointment cascades to its treatment.

---

### API Layer

```
src/api/
├── axiosInstance.js   Axios config, 401 retry interceptor, redirect guard
├── activation.js      setPassword, get2faSecret, verify2faSetup
├── auth.js            login, verifyMfaLogin, getMe, forgotPassword,
│                      resetPassword, logout, logoutAll
├── user.js            getProfile, updateName, addPhone, removePhone,
│                      addAddress, updateAddress, removeAddress,
│                      changePassword, changeEmail, verifyEmailChange,
│                      disable2fa, enable2fa, getDentists
├── admin.js           getAllUsers, getUser, createUser, updateUser,
│                      deleteUser, suspendUser, reactivateUser,
│                      forceLogoutUser, resendActivationEmail,
│                      reset2fa, assignRole, removeRole
└── clinic.js          getAllPatients, getPatient, createPatient, updatePatient,
                       deletePatient, getAllAppointments, getMyAppointments,
                       getAppointment, getAppointmentsByPatient,
                       createAppointment, updateAppointment, deleteAppointment,
                       getTreatment, getTreatmentByAppointment, createTreatment,
                       updateTreatment, deleteTreatment
```

---

## Security Architecture

**Password Security**: bcrypt hashing. Never stored or logged as plain text.

**Token Security**: Cryptographically random via `crypto.randomBytes`. Only hashed versions stored in PostgreSQL/Redis. Raw token sent to the user once via email.

**Session Security**: Server-side Redis storage. Client holds an opaque session ID in an httpOnly, secure, sameSite=strict cookie. No sensitive data in the cookie itself.

**Remember Me Rotation**: Remember Me tokens rotate on every use — the old token is deleted before the new one is created, closing the window for token replay attacks.

**MFA**: TOTP via speakeasy, issuer `DentaCore`. Secret persists in the database when MFA is disabled — re-enabling does not require a new QR scan unless an admin resets it. Admin reset clears the secret, sets status to `PENDING_MFA_SETUP`, and sends a new activation email so the user re-enters the setup flow.

**RBAC**: Fresh PostgreSQL role lookup on every request via `requirePermission`. Role changes take effect immediately without requiring re-login.

**Suspension Enforcement**: `requireAuth` fetches the full user record from PostgreSQL on every request. Suspended or deleted users are rejected at the middleware layer before reaching any controller.

**Input Validation**: Explicit field whitelists on all update endpoints. Status changes are rejected by `updateUserController` — status only changes through dedicated controllers (`suspendUser`, `reactivateUser`, activation flow).

**Self-Deletion Prevention**: Admins cannot delete or suspend their own account. Enforced on both backend (ID comparison) and frontend (`isSelf` check).

**Session Cleanup on Sensitive Operations**: Password change, 2FA disable, user deletion, and force logout all invalidate Redis sessions and remember tokens immediately. Remember tokens are deleted before sessions to close the race condition window where token rotation could create a new session after cleanup begins.

---

## Data Flow

**Account Creation and Activation:**
```
Admin creates user (email only)
    → PostgreSQL User row: PENDING_ACTIVATION, expiresAt +48hrs
    → Activation email sent via Resend
    → User clicks link → /activate?token=TOKEN
    → Sets password → status: PENDING_MFA_SETUP
    → QR code generated server-side, displayed for scanning
    → mfaSecret stored → status: PENDING_MFA_VERIFICATION
    → User verifies OTP → status: ACTIVE, mfaEnabled: true, expiresAt: null
    → Redirected to /login
```

**Expired Account Cleanup:**
```
Server starts → cleanupExpiredUsers() runs immediately
Hourly cron at :00 → DELETE FROM User WHERE expiresAt < NOW()
```

**Login with MFA:**
```
POST /auth/login → validate credentials → generate mfaLoginTokenId (Redis, 5 mins)
    → client navigates to /login/mfa
    → POST /auth/login/mfa/verify → validate OTP
    → create session in Redis (30 mins) → set SESSIONID cookie
    → client calls GET /auth/me → AuthContext populated
    → navigate to /home
```

**Remember Me Token Rotation:**
```
SESSIONID expired → requireAuth checks REMEMBER cookie
    → valid → delete old token → create new token (7 days)
    → create new session (30 mins) → set new cookies
    → request continues transparently
    → if second concurrent request fires before new cookie arrives:
        → 401 → axios interceptor retries once → succeeds with new cookie
```

**Authenticated Request:**
```
SESSIONID cookie → requireAuth
    → Redis session lookup → PostgreSQL user fetch
    → requirePermission → RBACConfig lookup
    → Controller → Service → Prisma → PostgreSQL
    → Response
```

**Clinic Flow:**
```
Register patient
    → Schedule appointment (links dentist + patient, status: SCHEDULED)
    → After visit: record treatment on appointment detail page
    → Appointment status auto-updates to COMPLETED
    → Treatment and cost visible in patient appointment history
```

---

## Environment Variables

```bash
# Server
PORT=5500
DATABASE_URL="postgresql://username@localhost:5432/erp_db"
REDIS_URL=redis://localhost:6379

# Email
RESEND_API_KEY=re_xxxxxxxxx
CLIENT_URL=http://localhost:5173
```