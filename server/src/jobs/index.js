import cron from 'node-cron';
import * as scheduler from './scheduler.js';
import * as maintenanceQueue from '../queues/maintenance.queue.js';
// Registers recurring schedules and enqueues the one-off startup catch-up.
// Returns the cron tasks so server.js can pass them into registerShutdown's
// existing `jobs` slot to stop them cleanly.
export const startJobs = async () => {
  // Startup catch-up — sweeps anything that accrued while the service was
  // down. Fixed lock key + short TTL so a multi-instance deploy enqueues
  // each once, not once per instance. The underlying jobs are idempotent,
  // so a rare race here is harmless.
  await scheduler.runOnce('lock:catchup:startup', 60, () =>
    Promise.all([
      maintenanceQueue.enqueueMaintenance(maintenanceQueue.MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS, {}),
      maintenanceQueue.enqueueMaintenance(maintenanceQueue.MAINTENANCE_JOBS.CLEANUP_PENDING_UPLOADS, {}),
      maintenanceQueue.enqueueMaintenance(maintenanceQueue.MAINTENANCE_JOBS.PURGE_EXPIRED_FILES, {}),
    ])
  )

  const hourlyCleanup = cron.schedule('0 * * * *', () => {
    const hourKey = new Date().toISOString().slice(0, 13) // e.g. 2026-08-13T09
    scheduler.runOnce(`lock:hourly-cleanup-expired-users:${hourKey}`, 300, () =>
      maintenanceQueue.enqueueMaintenance(maintenanceQueue.MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS, {})
    ).catch((err) => console.error('hourly-cleanup-expired-users enqueue failed:', err.message))
  })

  // 3am — explicitly in clinic time via node-cron's `timezone` option,
  // same behaviour as the old scheduler's `tz` field. CLINIC_TIMEZONE is
  // already required in validateEnv.
  const dailyPurge = cron.schedule(
    '0 3 * * *',
    () => {
      const dayKey = new Date().toISOString().slice(0, 10)
      scheduler.runOnce(`lock:daily-purge-expired-files:${dayKey}`, 300, () =>
        maintenanceQueue.enqueueMaintenance(maintenanceQueue.MAINTENANCE_JOBS.PURGE_EXPIRED_FILES, {})
      ).catch((err) => console.error('daily-purge-expired-files enqueue failed:', err.message))
    },
    { timezone: process.env.CLINIC_TIMEZONE }
  )

  const reconcilePayments = cron.schedule('*/10 * * * *', () => {
    const tickKey = new Date().toISOString().slice(0, 15) // e.g. 2026-08-25T10:2 — 10-min buckets
    scheduler.runOnce(`lock:reconcile-payments:${tickKey}`, 300, () =>
      maintenanceQueue.enqueueMaintenance(maintenanceQueue.MAINTENANCE_JOBS.RECONCILE_STALE_PAYMENT_ATTEMPTS, {})
    ).catch((err) => console.error('reconcile-payments enqueue failed:', err.message))
  })

  const checkDlqDepth = cron.schedule('*/10 * * * *', () => {
    const tickKey = new Date().toISOString().slice(0, 15)
    scheduler.runOnce(`lock:check-webhook-dlq:${tickKey}`, 300, () =>
      maintenanceQueue.enqueueMaintenance(maintenanceQueue.MAINTENANCE_JOBS.CHECK_WEBHOOK_DLQ_DEPTH, {})
    ).catch((err) => console.error('check-webhook-dlq enqueue failed:', err.message))
  })

  // don't forget to add it to the returned array:
  return [hourlyCleanup, dailyPurge, reconcilePayments, checkDlqDepth]
}