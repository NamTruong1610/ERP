export const SESSION_TTL_SECONDS = 30 * 60;
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REMEMBER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_TTL_SECONDS = 5 * 60;  // 5 minutes
export const MFA_LOGIN_TTL_SECONDS = 5 * 60;
export const MFA_LOGIN_MAP_TTL_SECONDS = 6 * 60;
export const MFA_SETUP_TTL_SECONDS = 10 * 60;
export const RECOVERY_TTL_SECONDS = 15 * 60;
export const RECOVERY_MAP_TTL_SECONDS = 16 * 60;
export const ACTIVATION_TTL_MS = 48 * 60 * 60 * 1000;
export const ACTIVATION_EMAIL_IDEMPOTENCY_MS = 5 * 60 * 1000;
export const RECOVERY_EMAIL_IDEMPOTENCY_MS = 5 * 60 * 1000;
// How long a soft-deleted file sticks around before the automated
// purge job permanently deletes it (DB row + R2 object).
export const FILE_PURGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: '/'
};
