# Dental Clinic ERP System — Software Architecture Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Backend Architecture](#backend-architecture)
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
5. [Frontend Architecture](#frontend-architecture)
   - [Project Setup](#project-setup)
   - [Auth Context & Route Guards](#auth-context--route-guards)
   - [Pages](#pages)
   - [API Layer](#api-layer)
6. [Security Architecture](#security-architecture)
7. [Data Flow](#data-flow)
8. [Environment Variables](#environment-variables)

---

## Project Overview

A full-stack Dental Clinic ERP (Enterprise Resource Planning) system built on top of a secure authentication and authorization foundation. The system supports user management, role-based access control, multi-factor authentication, and clinic-specific features including patient management, appointment scheduling, and treatment recording.

Built as a monorepo with a Node.js/Express backend and a React/Vite frontend.

---

## Tech Stack

### Backend
| Technology | Purpose |
| --- | --- |
| Node.js + Express | HTTP server and routing |
| PostgreSQL | Primary relational database |
| Prisma (v7) | ORM and database client |
| Redis | Session storage, token management, TTL-based cleanup |
| bcrypt | Password hashing |
| speakeasy | TOTP-based MFA (Google Authenticator compatible) |
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
│   │   ├── authRoutes.js            # Includes /me session check endpoint
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
│       └── cleanupUtils.js          # Expired user account cleanup
│
└── client/                          # Frontend
    ├── vite.config.js
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api/
    │   │   ├── axiosInstance.js     # Axios config, interceptors, redirect guard
    │   │   ├── activation.js
    │   │   ├── auth.js              # Includes getMe for session check
    │   │   ├── user.js
    │   │   ├── admin.js
    │   │   └── clinic.js            # Patients, appointments, treatments
    │   ├── context/
    │   │   ├── AuthContext.js
    │   │   ├── AuthProvider.jsx     # Calls /auth/me on mount
    │   │   └── useAuth.js
    │   ├── components/
    │   │   ├── ProtectedRoute.jsx
    │   │   └── AppSidebar.jsx       # Shared sidebar across all pages
    │   └── pages/
    │       ├── auth/
    │       ├── home/
    │       ├── profile/
    │       ├── admin/
    │       └── clinic/              # Patients, appointments, treatments
```

---

## Backend Architecture

### Entry Point

`index.js` bootstraps in this order:
1. Connect to PostgreSQL via Prisma
2. Connect to Redis
3. Seed admin user if not present
4. Start Express server
5. Run immediate expired account cleanup then schedule hourly cron job

```javascript
await prismaConnect()
await redisConnect()
await seedAdminUser()
await appConfig(app)
await cleanupExpiredUsers()
cron.schedule('0 * * * *', async () => { await cleanupExpiredUsers() })
```

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

**`RBACConfig.js`** defines all permissions and role assignments statically in code:

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
  STAFF: [ ...profile + clinic permissions ],
  ADMIN: [ ...all permissions ]
}
```

---

### Database

**PostgreSQL** accessed via **Prisma ORM**. Six tables:

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
| `mfaUri` | String? | otpauth URL |
| `mfaEnabled` | Boolean | |
| `expiresAt` | DateTime? | Null for permanent accounts |

**`UserName`** — One-to-one with User (cascade delete)

**`Address`** — One-to-many with User (cascade delete)

**`Patient`** — Dental clinic patients

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `firstName` | String | Required |
| `lastName` | String | Required |
| `dob` | DateTime | Date of birth |
| `gender` | String | Required |
| `phone` | String? | |
| `email` | String? | |
| `address` | String? | |

**`Appointment`** — Links dentist to patient

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `dentistId` | String | FK → User |
| `patientId` | String | FK → Patient |
| `date` | DateTime | |
| `status` | String | `SCHEDULED`, `COMPLETED`, `CANCELLED` |
| `notes` | String? | |

**`Treatment`** — One-to-one with Appointment (cascade delete)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | Primary key |
| `appointmentId` | String | Unique FK → Appointment |
| `procedure` | String | e.g. Filling, Extraction |
| `toothNumber` | Int? | 1–32 |
| `notes` | String? | |
| `cost` | Float | AUD |

**Entity Relationships:**
```
User (Dentist) ──── many ──── Appointment ──── one ──── Treatment
                                   │
Patient ────────── many ───────────┘
```

**TTL Strategy**: New users have `expiresAt` set to +48hrs. A cron job runs hourly deleting records where `expiresAt < now`. On activation, `expiresAt` is set to `null`.

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
| `user_sessions:{userId}` | Sorted Set | — | Session ID registry (score = expiry) |
| `user_remember:{userId}` | Sorted Set | — | Remember token registry (score = expiry) |
| `user_mfa_login:{userId}` | String (JSON) | 6 mins | User → MFA login token map |
| `user_recover:{userId}` | String (JSON) | 16 mins | User → recovery token map |
| `user_email_change:{userId}` | String (JSON) | 16 mins | User → email change token map |

Sorted sets use expiry timestamps as scores enabling lazy zombie cleanup via `ZREMRANGEBYSCORE key 0 Date.now()` on every authenticated request.

---

### Authentication & Session Management

**Login (no MFA):** Validate credentials → generate sessionId → store in Redis → set cookie

**Login (with MFA):** Validate credentials → generate mfaLoginTokenId → return to client → client submits OTP → validate → create session

**Session Validation (`requireAuth`):** Check SESSIONID cookie → Redis lookup → PostgreSQL user fetch → set req.user. Falls back to REMEMBER cookie with token rotation.

**`GET /api/v2/auth/me`:** Lightweight session check endpoint. Returns only `{ id, roles }`. Used by `AuthProvider` on mount — intentionally separate from `getProfile` to keep concerns distinct and response minimal.

---

### Middleware

**`requireAuth`**: Validates session, fetches fresh user from PostgreSQL on every request (ensures immediate suspension enforcement), sets `req.user`.

**`requirePermission(permission)`**: Factory returning async middleware. Fresh PostgreSQL role lookup on every request ensures role changes take effect immediately.

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

### Services

All Prisma queries are in service files. Controllers never call Prisma directly.

**`userService.js`**: User CRUD, roles, name/phone/address operations. `updateUser` strips internal Prisma relation fields (`id`, `userId`) from nested name objects before passing to upsert.

**`patientService.js`**: Patient CRUD. `findPatientById` includes full appointment and treatment history.

**`appointmentService.js`**: Appointment CRUD with dentist/patient filtering. All queries include dentist, patient, and treatment relations.

**`treatmentService.js`**: Treatment CRUD. All queries include full appointment with dentist and patient.

---

### Utilities

**`activationTokenUtils.js`**: Cryptographically random token generation. Only hashed versions stored — raw token sent to user once.

**`passwordUtils.js`**: bcrypt hashing and comparison.

**`mfaUtils.js`**: speakeasy TOTP secret generation and OTP verification.

**`emailUtils.js`**: Resend SDK wrapper. Three email types: activation, password recovery, email change verification.

**`cleanupUtils.js`**: `DELETE FROM User WHERE expiresAt < NOW()` — replaces MongoDB's TTL index.

---

## Frontend Architecture

### Project Setup

**`vite.config.js`**: Proxies `/api` requests from port 5173 → 5500. Solves CORS in development.

**`axiosInstance.js`**:
- `baseURL: '/api/v2'`, `withCredentials: true`
- 401 interceptor with `isRedirecting` flag prevents double redirects from simultaneous failing requests
- Public paths excluded from redirect: `/login`, `/activate`, `/forgot-password`, `/reset-password`

---

### Auth Context & Route Guards

**`AuthProvider.jsx`**:
- Calls `GET /api/v2/auth/me` on mount — not `getProfile`. Returns only `{ id, roles }` for minimal response and clear separation of concerns.
- Only clears `user` on 401 — a 500 server error does not log the user out
- Exposes `user`, `loading`, `login()`, `logoutUser()`, `isAdmin()`

**`AppSidebar.jsx`**: Shared sidebar across all authenticated pages. Navigation sections: Main (Home, Profile), Clinic (Patients, Appointments), Admin (admin only), Session (Sign out). `active` prop highlights current page link.

**`ProtectedRoute`**: Redirects to `/login` if unauthenticated.

**`AdminRoute`**: Redirects non-admins to `/home`.

---

### Pages

**Activation** (`/activate` → `/activate/2fa` → `/activate/2fa/verify`): Three-step flow, state passed via router state.

**Auth**: Login → `/home`, MFA login, forgot/reset password.

**Home** (`/home`): Default landing page. Personalised greeting, role badge, empty state ready for future dashboard widgets.

**Profile** (`/profile`): Name, phones, addresses, password, email, 2FA sections. `AddressForm` at module level to prevent remount. 2FA disable calls `logoutUser()` before navigating.

**Admin**: User list with search, user detail with contextual actions. Self-deletion prevented on frontend (`isSelf` check) and backend.

**Clinic**:
- `Patients.jsx` / `PatientDetail.jsx` — patient CRUD, appointment history. Uses `useReducer` for forms, `useRef` for search auto-focus.
- `Appointments.jsx` / `AppointmentDetail.jsx` — admins see all, dentists see own. Treatment recorded inline on appointment detail. Recording treatment auto-completes the appointment.

---

### API Layer

```
src/api/
├── axiosInstance.js
├── activation.js   setPassword, get2faSecret, verify2faSetup
├── auth.js         login, verifyMfaLogin, getMe, forgotPassword,
│                   resetPassword, logout, logoutAll
├── user.js         getProfile, updateName, addPhone, removePhone,
│                   addAddress, updateAddress, removeAddress,
│                   changePassword, changeEmail, verifyEmailChange,
│                   disable2fa, enable2fa
├── admin.js        getAllUsers, getUser, createUser, updateUser,
│                   deleteUser, suspendUser, reactivateUser,
│                   forceLogoutUser, resendActivationEmail,
│                   reset2fa, assignRole, removeRole
└── clinic.js       getAllPatients, getPatient, createPatient, updatePatient,
                    deletePatient, getAllAppointments, getMyAppointments,
                    getAppointment, getAppointmentsByPatient,
                    createAppointment, updateAppointment, deleteAppointment,
                    getTreatment, getTreatmentByAppointment, createTreatment,
                    updateTreatment, deleteTreatment
```

---

## Security Architecture

**Password Security**: bcrypt hashing. Never stored or logged as plain text.

**Token Security**: Cryptographically random. Only hashed versions in PostgreSQL/Redis. Raw token sent once.

**Session Security**: Server-side Redis storage. Client holds opaque ID in httpOnly, secure, sameSite=strict cookie.

**Cookie Rotation**: Remember Me tokens rotate on every use.

**MFA**: TOTP via speakeasy. Secret persists when disabled — re-enabling doesn't require new QR scan unless admin resets it.

**RBAC**: Fresh PostgreSQL role lookup on every request. Role changes take effect immediately.

**Suspension Enforcement**: `requireAuth` fetches user on every request. Suspended users rejected immediately.

**Input Validation**: Explicit field whitelists on update endpoints. Prisma relation fields stripped from nested objects before update.

**Self-Deletion Prevention**: Admins cannot delete own account — enforced on backend and frontend.

**Session Check Separation**: `/auth/me` for session validation (returns `{ id, roles }`). `/user/profile` for full profile data. Intentionally separate concerns.

---

## Data Flow

**Account Creation and Activation:**
```
Admin creates user (email only)
    → PostgreSQL User row created, PENDING_ACTIVATION, expiresAt +48hrs
    → Activation email sent (Resend)
    → User clicks link → /activate?token=TOKEN
    → Sets password → status: PENDING_MFA_SETUP
    → Scans QR → mfaSecret stored, status: PENDING_MFA_VERIFICATION
    → Verifies OTP → status: ACTIVE, mfaEnabled: true, expiresAt: null
```

**Expired Account Cleanup:**
```
Server starts → cleanupExpiredUsers() runs immediately
Cron job runs every hour at :00 → DELETE WHERE expiresAt < NOW()
```

**Login with MFA:**
```
Submit email + password → validate → generate mfaLoginTokenId (Redis, 5 mins)
    → Navigate to /login/mfa
    → Submit OTP → validate → create session in Redis
    → login({ id, roles }) called in AuthContext
    → Navigate to /home
```

**Authenticated Request:**
```
SESSIONID cookie → requireAuth → Redis lookup → PostgreSQL user fetch
    → requirePermission → PostgreSQL roles → RBACConfig lookup
    → Controller → Response
```

**Clinic Flow:**
```
Register patient → Schedule appointment (links dentist + patient)
    → After visit: record treatment on appointment detail page
    → Appointment status auto-updates to COMPLETED
    → Treatment visible in patient appointment history
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