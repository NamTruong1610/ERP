const { Queue } = require('bullmq')
const { bullConnection } = require('../config/queueConfig')

// Job names — the maintenance worker switches on these.
const MAINTENANCE_JOBS = Object.freeze({
  CLEANUP_EXPIRED_USERS: 'cleanupExpiredUsers',
  CLEANUP_PENDING_UPLOADS: 'cleanupPendingUploads',
  PURGE_EXPIRED_FILES: 'purgeExpiredSoftDeletedFiles',
})

const maintenanceQueue = new Queue('maintenance', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: true,
    removeOnFail: { age: 7 * 24 * 3600, count: 50 },
  },
})

// Recurring schedules. upsertJobScheduler is keyed by its id, so every backend
// instance calling this collapses to ONE schedule in Redis — that's what stops
// the double-firing you get from in-process node-cron on multiple instances.
// Whichever worker is free at fire time runs the job once.
const registerMaintenanceSchedules = async () => {
  await maintenanceQueue.upsertJobScheduler(
    'hourly-cleanup-expired-users',
    { pattern: '0 * * * *' },
    { name: MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS }
  )

  // 3am — now explicitly in clinic time rather than the container's TZ, which
  // is the one behaviour change from the old cron. CLINIC_TIMEZONE is already
  // required in validateEnv, so this is safe.
  await maintenanceQueue.upsertJobScheduler(
    'daily-purge-expired-files',
    { pattern: '0 3 * * *', tz: process.env.CLINIC_TIMEZONE },
    { name: MAINTENANCE_JOBS.PURGE_EXPIRED_FILES }
  )
}

// One-off catch-up on boot, sweeping anything that accrued while the service
// was down — the schedulers only fire going forward, they don't backfill.
// Fixed jobId so a multi-instance deploy enqueues each once, not once per
// instance; removeOnFail:true so a failed catch-up can't wedge the id for the
// next boot. The underlying jobs are idempotent, so a rare race is harmless.
const enqueueStartupCatchup = async () => {
  const opts = (jobId) => ({ jobId, removeOnFail: true })
  await Promise.all([
    maintenanceQueue.add(MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS, {}, opts('catchup-cleanupExpiredUsers')),
    maintenanceQueue.add(MAINTENANCE_JOBS.CLEANUP_PENDING_UPLOADS, {}, opts('catchup-cleanupPendingUploads')),
    maintenanceQueue.add(MAINTENANCE_JOBS.PURGE_EXPIRED_FILES, {}, opts('catchup-purgeExpiredSoftDeletedFiles')),
  ])
}

module.exports = {
  maintenanceQueue,
  MAINTENANCE_JOBS,
  registerMaintenanceSchedules,
  enqueueStartupCatchup,
}