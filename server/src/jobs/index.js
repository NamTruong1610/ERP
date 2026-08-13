const cron = require('node-cron')
const { runOnce } = require('./scheduler')
const { enqueueMaintenance, MAINTENANCE_JOBS } = require('../queues/maintenanceQueue')

// Registers recurring schedules and enqueues the one-off startup catch-up.
// Returns the cron tasks so server.js can pass them into registerShutdown's
// existing `jobs` slot to stop them cleanly.
exports.startJobs = async () => {
  // Startup catch-up — sweeps anything that accrued while the service was
  // down. Fixed lock key + short TTL so a multi-instance deploy enqueues
  // each once, not once per instance. The underlying jobs are idempotent,
  // so a rare race here is harmless.
  await runOnce('lock:catchup:startup', 60, () =>
    Promise.all([
      enqueueMaintenance(MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS, {}),
      enqueueMaintenance(MAINTENANCE_JOBS.CLEANUP_PENDING_UPLOADS, {}),
      enqueueMaintenance(MAINTENANCE_JOBS.PURGE_EXPIRED_FILES, {}),
    ])
  )

  const hourlyCleanup = cron.schedule('0 * * * *', () => {
    const hourKey = new Date().toISOString().slice(0, 13) // e.g. 2026-08-13T09
    runOnce(`lock:hourly-cleanup-expired-users:${hourKey}`, 300, () =>
      enqueueMaintenance(MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS, {})
    ).catch((err) => console.error('hourly-cleanup-expired-users enqueue failed:', err.message))
  })

  // 3am — explicitly in clinic time via node-cron's `timezone` option,
  // same behaviour as the old scheduler's `tz` field. CLINIC_TIMEZONE is
  // already required in validateEnv.
  const dailyPurge = cron.schedule(
    '0 3 * * *',
    () => {
      const dayKey = new Date().toISOString().slice(0, 10)
      runOnce(`lock:daily-purge-expired-files:${dayKey}`, 300, () =>
        enqueueMaintenance(MAINTENANCE_JOBS.PURGE_EXPIRED_FILES, {})
      ).catch((err) => console.error('daily-purge-expired-files enqueue failed:', err.message))
    },
    { timezone: process.env.CLINIC_TIMEZONE }
  )

  return [hourlyCleanup, dailyPurge]
}