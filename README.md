# ERP System — Software Architecture Documentation

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

A full-stack ERP (Enterprise Resource Planning) system with secure user authentication, role-based access control, multi-factor authentication, and user management. Built as a monorepo with a Node.js/Express backend and a React/Vite frontend.

---

## Tech Stack

### Backend
| Technology | Purpose |
| --- | --- |
| Node.js + Express | HTTP server and routing |
| MongoDB + Mongoose | Primary database and ODM |
| Redis | Session storage, token management, TTL-based cleanup |
| bcrypt | Password hashing |
| speakeasy | TOTP-based MFA (Google Authenticator compatible) |
| Resend | Transactional email delivery |
| helmet | HTTP security headers |
| cookie-parser | Cookie parsing middleware |

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
├── server/                        # Backend
│   ├── index.js                   # Entry point
│   ├── config/
│   │   ├── appConfig.js           # Express setup, middleware, route mounting
│   │   ├── MongoConfig.js         # MongoDB connection
│   │   ├── RedisConfig.js         # Redis client
│   │   └── RBACConfig.js          # Roles and permissions definitions
│   ├── controllers/
│   │   ├── activationControllers.js
│   │   ├── authControllers.js
│   │   ├── userControllers.js
│   │   └── adminControllers.js
│   ├── middlewares/
│   │   ├── authMiddleware.js      # Session validation (requireAuth)
│   │   └── rbacMiddleware.js      # Permission checking (requirePermission)
│   ├── models/
│   │   └── User.js                # Mongoose user schema
│   ├── routes/
│   │   ├── activationRoutes.js
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   └── adminRoutes.js
│   ├── services/
│   │   └── userService.js         # Database query functions
│   └── utils/
│       ├── activationTokenUtils.js
│       ├── passwordUtils.js
│       ├── mfaUtils.js
│       └── emailUtils.js
│
└── client/                        # Frontend
    ├── vite.config.js
    ├── src/
    │   ├── main.jsx               # App entry point
    │   ├── App.jsx                # Router and route definitions
    │   ├── api/
    │   │   ├── axiosInstance.js   # Axios config and interceptors
    │   │   ├── activation.js
    │   │   ├── auth.js
    │   │   ├── user.js
    │   │   └── admin.js
    │   ├── context/
    │   │   ├── AuthContext.js     # React context definition
    │   │   ├── AuthProvider.jsx   # Context provider with session logic
    │   │   └── useAuth.js         # Custom hook for consuming context
    │   ├── components/
    │   │   └── ProtectedRoute.jsx # Route guard components
    │   └── pages/
    │       ├── auth/              # Login, MFA, forgot/reset password, activation
    │       ├── profile/           # User profile management
    │       └── admin/             # Admin user management
```

---

## Backend Architecture

### Entry Point

`index.js` bootstraps the application by connecting to MongoDB and Redis before starting the Express server. The order matters — the app should not accept requests before database connections are established.

### Configuration

**`appConfig.js`** configures the Express application:
- Applies `helmet` for security headers
- Applies `cookie-parser` to parse incoming cookies
- Applies `express.json()` to parse JSON request bodies
- Mounts all route groups under versioned prefixes

```
/api/v2/activate   → activationRoutes
/api/v2/auth       → authRoutes
/api/v2/user       → userRoutes
/api/v2/admin      → adminRoutes
```

**`RBACConfig.js`** is a static JavaScript file that defines all permissions and which roles have them. Keeping this in code rather than the database avoids DB queries on every request while still being easy to update via a code deployment.

```javascript
PERMISSIONS = {
  PROFILE_READ, PROFILE_UPDATE, PROFILE_PASSWORD_CHANGE,
  PROFILE_EMAIL_CHANGE, PROFILE_PHONES_MANAGE, PROFILE_ADDRESSES_MANAGE,
  USERS_READ, USERS_CREATE, USERS_UPDATE, USERS_DELETE,
  USERS_SUSPEND, USERS_REACTIVATE, USERS_FORCE_LOGOUT,
  USERS_RESEND_ACTIVATION, USERS_RESET_2FA, USERS_ROLES_MANAGE
}

ROLES = {
  STAFF: [ ...profile permissions ],
  ADMIN: [ ...all permissions ]
}
```

---

### Database

**User Schema (`models/User.js`)**

| Field | Type | Notes |
| --- | --- | --- |
| `email` | String | Unique, required |
| `password` | String | bcrypt hashed |
| `name` | Object | `{ fName, mName, lName }` |
| `phones` | [String] | Array of phone numbers |
| `addresses` | [Object] | Subdocuments with `_id` auto-assigned by Mongoose |
| `roles` | [String] | Default: `["STAFF"]` |
| `status` | String | `PENDING_ACTIVATION` → `PENDING_MFA_SETUP` → `PENDING_MFA_VERIFICATION` → `ACTIVE` |
| `mfaSecret` | String | TOTP secret (base32) |
| `mfaUri` | String | otpauth URL for QR generation |
| `mfaEnabled` | Boolean | Whether 2FA is enforced on login |
| `activationTokenId` | String | Hashed activation token, `sparse: true` unique index |
| `expiresAt` | Date | MongoDB TTL index (`expireAfterSeconds: 0`). Set to `null` for permanent documents |

**TTL Strategy**: New users are given a 48-hour `expiresAt` timestamp. MongoDB automatically deletes the document if activation is not completed in time. On successful activation, `expiresAt` is set to `null` which causes the TTL monitor to ignore the document permanently.

---

### Redis

Redis is used for all ephemeral data that needs fast access and automatic expiry. The following key namespaces are used:

| Key Pattern | Type | TTL | Purpose |
| --- | --- | --- | --- |
| `session:{sessionId}` | String (JSON) | 30 mins | Active login session |
| `token:remember:{tokenId}` | String (JSON) | 7 days | Remember Me token |
| `token:mfa_login:{tokenId}` | String (JSON) | 5 mins | MFA login handshake token |
| `token:recover:{tokenId}` | String (JSON) | 15 mins | Password recovery token |
| `token:email_change:{tokenId}` | String (JSON) | 15 mins | Email change verification token |
| `mfa:{userId}` | String | 10 mins | MFA setup handshake token |
| `user_sessions:{userId}` | Sorted Set | — | Registry of session IDs (score = expiry timestamp) |
| `user_remember:{userId}` | Sorted Set | — | Registry of remember token IDs (score = expiry timestamp) |
| `user_mfa_login:{userId}` | String (JSON) | 6 mins | User → MFA login token mapping |
| `user_recover:{userId}` | String (JSON) | 16 mins | User → recovery token mapping |
| `user_email_change:{userId}` | String (JSON) | 16 mins | User → email change token mapping |

**Sorted Sets for session/token registries**: The `user_sessions` and `user_remember` sets use the token expiry timestamp as the score. This allows stale entries (tokens that expired via TTL) to be bulk-purged with a single Redis command `ZREMRANGEBYSCORE key 0 Date.now()` without needing to check each token individually.

**User → token mappings**: A secondary key maps each user to their current active token for flows that require verifying the token belongs to a specific user (e.g. preventing token reuse across accounts). The mapping TTL is always 1 minute longer than the token TTL to ensure the mapping outlives the token.

---

### Authentication & Session Management

**Login Flow (no MFA):**
1. Validate credentials against the database
2. Generate a random `sessionId`
3. Store session data (userId, userAgent, IP, createdAt) in Redis with 30-min TTL
4. Add `sessionId` to `user_sessions` sorted set with expiry score
5. Set `SESSIONID` httpOnly cookie
6. Optionally generate a remember token and set `REMEMBER` httpOnly cookie

**Login Flow (with MFA):**
1. Validate credentials
2. Generate `mfaLoginTokenId`, store in Redis with 5-min TTL
3. Return `mfaLoginTokenId` to client
4. Client submits OTP + `mfaLoginTokenId`
5. Validate OTP against user's `mfaSecret`
6. Create session and set cookies (same as no-MFA flow)

**Session Validation (`requireAuth` middleware):**
1. Check `SESSIONID` cookie → look up in Redis → if valid, fetch fresh user from DB, set `req.user`
2. If no valid session, check `REMEMBER` cookie → rotate remember token → create new session → set new cookies

**Lazy Session Cleanup**: On every authenticated request, stale entries are purged from the sorted sets using `ZREMRANGEBYSCORE`. This is O(log N) and runs as a side effect of normal requests rather than on a separate schedule.

---

### Middleware

**`requireAuth`**

Validates the incoming request has a live session. Checks `SESSIONID` cookie first, falls back to `REMEMBER` cookie. Fetches the user record from MongoDB on every request to ensure roles and status are always fresh (important for immediately reflecting suspensions and role changes). Sets `req.user` for downstream use.

**`requirePermission(permission)`**

A middleware factory — takes a permission string and returns an async middleware function. Fetches the user's roles from the database, looks up their permissions in `RBACConfig.js`, and either calls `next()` or returns 403. Running the DB query here (rather than relying on cached roles in the session) ensures role changes take effect immediately.

---

### Routes

All routes follow REST conventions:

```
POST   /api/v2/activate/password          Set password during activation
POST   /api/v2/activate/mfa/secret        Get QR code for 2FA setup
POST   /api/v2/activate/mfa/verify        Verify OTP to complete activation

POST   /api/v2/auth/login                 Login
POST   /api/v2/auth/login/mfa/verify      Verify MFA OTP during login
POST   /api/v2/auth/logout                Logout current session
POST   /api/v2/auth/logout/all            Logout all sessions
POST   /api/v2/auth/forgot-password       Request password reset email
POST   /api/v2/auth/reset-password        Reset password with token

GET    /api/v2/user/profile               Get own profile
POST   /api/v2/user/name                  Update name
POST   /api/v2/user/phones                Add phone
DELETE /api/v2/user/phones/:phone         Remove phone
POST   /api/v2/user/addresses             Add address
PATCH  /api/v2/user/addresses/:addressId  Update address
DELETE /api/v2/user/addresses/:addressId  Remove address
POST   /api/v2/user/password              Change password
POST   /api/v2/user/email                 Request email change
POST   /api/v2/user/email/verify          Verify email change
POST   /api/v2/user/2fa/enable            Enable 2FA
POST   /api/v2/user/2fa/disable           Disable 2FA

GET    /api/v2/admin/users                List all users
GET    /api/v2/admin/users/:id            Get user detail
POST   /api/v2/admin/users                Create user
PATCH  /api/v2/admin/users/:id            Update user
DELETE /api/v2/admin/users/:id            Delete user
POST   /api/v2/admin/users/:id/suspend           Suspend user
POST   /api/v2/admin/users/:id/reactivate        Reactivate user
POST   /api/v2/admin/users/:id/force-logout      Force logout all sessions
POST   /api/v2/admin/users/:id/resend-activation Resend activation email
POST   /api/v2/admin/users/:id/reset-2fa         Reset 2FA secret
POST   /api/v2/admin/users/:id/roles             Assign role
DELETE /api/v2/admin/users/:id/roles             Remove role
```

---

### Controllers

Controllers handle HTTP request/response logic only. They validate input, call service functions, interact with Redis, and return JSON responses. Business logic lives in services and utilities, not in controllers.

**Activation Controllers**: Handle the 3-step account activation flow. Manage handshake tokens in Redis to securely pass state between steps without exposing data in the URL.

**Auth Controllers**: Handle login (both MFA and non-MFA paths), logout, and password recovery. The `loginController` conditionally returns either a session cookie (no MFA) or an `mfaLoginTokenId` (MFA required) so the frontend knows which flow to follow.

**User Controllers**: All protected by `requireAuth` and `requirePermission`. Handle self-service profile management. Password and 2FA changes invalidate all sessions to force re-authentication on other devices.

**Admin Controllers**: Protected by `requireAuth` and `requirePermission` with admin-level permissions. Provide full user lifecycle management. Actions like suspend and reset-2FA invalidate the target user's Redis sessions immediately.

---

### Services

`userService.js` contains all direct MongoDB queries. Controllers never call Mongoose models directly — they go through services. This separation makes it easy to swap the database layer without touching controllers.

Key service functions:
- `findUserById`, `findUserByEmail`, `findUserByActivationToken`
- `createUser`, `updateUser`, `deleteUserById`
- `findAllUsers` — uses `.select()` to exclude sensitive fields from list responses
- `createUserRole`, `deleteUserRole` — manage the roles array on the user document
- `deleteUserExpiresAtById` — sets `expiresAt` to null to cancel the TTL

---

### Utilities

**`activationTokenUtils.js`**: Generates cryptographically random tokens using Node's `crypto` module. Tokens are stored hashed (using SHA-256 or similar) in the database/Redis, and the raw token is sent to the user. This means a database breach doesn't expose valid tokens.

**`passwordUtils.js`**: Wraps bcrypt for hashing and comparison. The salt rounds are configurable via environment variables.

**`mfaUtils.js`**: Wraps speakeasy to generate TOTP secrets and verify OTP codes. The secret is stored on the user document and the QR URI is generated from it for scanning with authenticator apps.

**`emailUtils.js`**: Wraps the Resend SDK to send transactional emails. Three email types: account activation, password recovery, and email change verification. Each email contains a link with a raw token in the query string pointing to the appropriate frontend route.

---

## Frontend Architecture

### Project Setup

**`vite.config.js`** configures a proxy that forwards all requests starting with `/api` from the Vite dev server (port 5173) to the backend (port 5500). This solves CORS in development and means all API calls use relative URLs.

**`main.jsx`** is the app entry point. It wraps the entire application in `AuthProvider` so auth context is available to every component in the tree.

**`axiosInstance.js`** creates a configured Axios instance used by all API functions:
- `baseURL: '/api/v2'` — all requests are relative to the API prefix
- `withCredentials: true` — ensures cookies are sent with every request
- Response interceptor — catches 401 responses and redirects to `/login` unless already on the login page (prevents infinite redirect loops)

---

### Auth Context & Route Guards

**`AuthContext.js`**: Creates the React context with `createContext(null)`. Kept in a separate file from the provider to satisfy React fast-refresh rules (files should export only components or only non-components, not both).

**`AuthProvider.jsx`**: Wraps the app and maintains global auth state:
- On mount, calls `GET /api/v2/user/profile` to check if an existing session cookie is valid
- `loading: true` during this check prevents protected routes from flashing to `/login`
- Exposes `user`, `loading`, `login()`, `logoutUser()`, and `isAdmin()` to all children
- `login()` and `logoutUser()` are manual setters called after login/logout actions to immediately sync context without waiting for another API round trip

**`useAuth.js`**: Custom hook that calls `useContext(AuthContext)`. Separated into its own file (not exported from `AuthProvider.jsx`) to comply with React fast-refresh which requires files to only export components.

**`ProtectedRoute.jsx`**: Wrapper component used in `App.jsx` to guard routes. Shows a loading screen while session check is in progress, redirects to `/login` if not authenticated, otherwise renders children. `AdminRoute` extends this with an additional `isAdmin()` check, redirecting to `/profile` for authenticated non-admin users.

---

### Pages

**Activation Flow** (`/activate` → `/activate/2fa` → `/activate/2fa/verify`):

Three-step flow triggered by the activation email link. State (tokens) is passed between steps via React Router's `navigate(..., { state })` — never localStorage. Each step validates the presence of required state and redirects back if missing, preventing users from accessing later steps directly.

**Auth Flow**:

- `Login.jsx` — checks if already logged in on mount and redirects to `/profile`. Handles both MFA and non-MFA paths based on the login response. Calls `login()` from context after success to immediately update auth state.
- `VerifyMfaLogin.jsx` — receives `mfaLoginTokenId` via route state, submits OTP to complete login.
- `ForgotPassword.jsx` — always shows a success message regardless of whether the email exists, preventing email enumeration.
- `ResetPassword.jsx` — reads `?token=` from URL query params, same pattern as the activation flow.

**Profile Page** (`/profile`):

Single page with all profile sections rendered vertically with a sticky sidebar for navigation. Each section is a separate component (`NameSection`, `PhonesSection`, `AddressesSection`, `PasswordSection`, `EmailSection`, `TwoFASection`) that manages its own form state independently. All sections share an `onUpdate` callback that re-fetches the profile to keep the page in sync after mutations.

`AddressForm` is defined outside `AddressesSection` at the module level — a critical detail since defining components inside other components causes them to remount on every render, which breaks input focus.

`VerifyEmailChange.jsx` is a separate page at `/profile/email/verify` that auto-fires the verification API call on mount using the `?token=` query param from the email link.

**Admin Pages**:

- `AdminUsers.jsx` — displays a searchable, clickable user table. Client-side filtering across email, name, and status. `CreateUserModal` is defined at module level (not inside the page component) to avoid remount issues. Clicking a row navigates to the detail page.
- `AdminUserDetail.jsx` — shows full user data with contextual action buttons that only render when relevant (e.g. "Suspend" only for active users, "Reset 2FA" only when MFA is enabled). All actions share a `runAction(label, fn)` helper that handles loading state, error display, success feedback, and data refresh without duplicating the try/catch pattern for each action.

---

### API Layer

Each page area has a corresponding file in `src/api/`:

- `activation.js` — `setPassword`, `get2faSecret`, `verify2faSetup`
- `auth.js` — `login`, `verifyMfaLogin`, `forgotPassword`, `resetPassword`, `logout`, `logoutAll`
- `user.js` — `getProfile`, `updateName`, `addPhone`, `removePhone`, `addAddress`, `updateAddress`, `removeAddress`, `changePassword`, `changeEmail`, `verifyEmailChange`, `disable2fa`, `enable2fa`
- `admin.js` — `getAllUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`, `suspendUser`, `reactivateUser`, `forceLogoutUser`, `resendActivationEmail`, `reset2fa`, `assignRole`, `removeRole`

All API functions use the shared `axiosInstance` and return the `data` property of the Axios response directly, so callers receive the parsed JSON without extra unwrapping.

---

## Security Architecture

**Password Security**: Passwords are hashed with bcrypt before storage. The plain text password is never stored or logged. Password comparison uses bcrypt's timing-safe compare function.

**Token Security**: All tokens (activation, recovery, MFA handshake, email change) are generated as cryptographically random values. Only the hashed version is stored in the database or Redis. The raw token is sent to the user once. A database or Redis breach does not expose usable tokens.

**Session Security**: Sessions are stored entirely server-side in Redis. The client only holds an opaque session ID in an httpOnly cookie (not accessible to JavaScript). `secure: true` ensures cookies are only sent over HTTPS. `sameSite: strict` prevents cross-site request forgery.

**Cookie Rotation**: Remember Me tokens are rotated on every use — the old token is deleted and a new one is issued. This limits the window of exposure if a token is intercepted.

**MFA**: Time-based One-Time Passwords (TOTP) compatible with standard authenticator apps. The secret is stored on the user document and verified server-side. The secret persists even when 2FA is disabled, so re-enabling doesn't require a new QR scan unless an admin explicitly resets it.

**RBAC**: Permissions are checked on every request by `requirePermission` middleware using a fresh DB lookup (not cached session data). This ensures role changes take effect immediately without requiring the user to log out and back in.

**Suspension Enforcement**: `requireAuth` fetches the user from MongoDB on every request and checks `status === "ACTIVE"`. A suspended user is rejected at the middleware level regardless of having a valid session cookie, and the frontend's 401 interceptor redirects them to the login page immediately.

**Input Validation**: Admin-facing update endpoints use explicit field whitelists — only fields in `allowedFields` are applied to the database, preventing arbitrary field injection (e.g. a user cannot set their own `status` or `mfaSecret` through the update endpoint).

---

## Data Flow

**Account Creation and Activation:**
```
Admin creates user (email only)
    → MongoDB document created with PENDING_ACTIVATION status and 48hr TTL
    → Activation email sent with raw token
    → User clicks link → /activate?token=TOKEN
    → User sets password → status: PENDING_MFA_SETUP
    → User scans QR code → mfaSecret stored, status: PENDING_MFA_VERIFICATION
    → User verifies OTP → status: ACTIVE, mfaEnabled: true, expiresAt: null
```

**Login with MFA:**
```
User submits email + password
    → Credentials validated
    → mfaLoginTokenId generated and stored in Redis (5 mins)
    → Frontend redirected to /login/mfa with token
    → User submits OTP + token
    → OTP verified against mfaSecret
    → Session created in Redis, SESSIONID cookie set
    → Frontend calls getProfile(), updates AuthContext
    → User redirected to /profile
```

**Authenticated Request:**
```
Browser sends request with SESSIONID cookie
    → requireAuth: Redis lookup for session
    → MongoDB lookup for user (checks status === ACTIVE)
    → requirePermission: MongoDB lookup for roles, RBACConfig lookup for permissions
    → Controller executes
    → Response returned
```

---

## Environment Variables

```bash
# Server
PORT=5500
MONGO_URI=mongodb://localhost:27017/erp_db
REDIS_URL=redis://localhost:6379

# Email
RESEND_API_KEY=re_xxxxxxxxx
CLIENT_URL=http://localhost:5173
```
