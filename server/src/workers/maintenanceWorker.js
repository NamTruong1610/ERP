const { consumeWithRetry } = require('../lib/queue/retryableQueue')
const { QUEUE_NAME, MAINTENANCE_JOBS } = require('../queues/maintenanceQueue')

const { cleanupExpiredUsers } = require('../jobs/cleanupExpiredUsers')
const { cleanupPendingUploads } = require('../jobs/cleanupPendingUploads')
const { purgeExpiredSoftDeletedFiles } = require('../jobs/purgeExpiredFiles')

const handlers = {
  [MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS]: () => cleanupExpiredUsers(),
  [MAINTENANCE_JOBS.CLEANUP_PENDING_UPLOADS]: () => cleanupPendingUploads(),
  [MAINTENANCE_JOBS.PURGE_EXPIRED_FILES]: () => purgeExpiredSoftDeletedFiles(),
}

const startMaintenanceWorker = () =>
  consumeWithRetry(QUEUE_NAME, handlers, {
    maxAttempts: 3,
    baseDelayMs: 30_000,
    concurrency: 1, // one sweep at a time, same as before
  })

module.exports = { startMaintenanceWorker }