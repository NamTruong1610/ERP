module.exports = {
  SESSION_TTL_SECONDS: 30 * 60,
  SESSION_TTL_MS: 30 * 60 * 1000,
  REMEMBER_TTL_SECONDS: 7 * 24 * 60 * 60,
  REMEMBER_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  CACHE_TTL_SECONDS: 5 * 60,  // 5 minutes
  MFA_LOGIN_TTL_SECONDS: 5 * 60,
  MFA_LOGIN_MAP_TTL_SECONDS: 6 * 60,
  MFA_SETUP_TTL_SECONDS: 10 * 60,
  RECOVERY_TTL_SECONDS: 15 * 60,
  RECOVERY_MAP_TTL_SECONDS: 16 * 60,
  ACTIVATION_TTL_MS: 48 * 60 * 60 * 1000,
  ACTIVATION_EMAIL_IDEMPOTENCY_MS: 5 * 60 * 1000,
  RECOVERY_EMAIL_IDEMPOTENCY_MS: 5 * 60 * 1000, 
  // How long a soft-deleted file sticks around before the automated
  // purge job permanently deletes it (DB row + R2 object).
  FILE_PURGE_RETENTION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: '/' 
  }
}