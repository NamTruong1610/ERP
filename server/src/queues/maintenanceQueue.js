const { publishJob } = require('../lib/queue/retryableQueue')

const MAINTENANCE_JOBS = Object.freeze({
  CLEANUP_EXPIRED_USERS: 'cleanupExpiredUsers',
  CLEANUP_PENDING_UPLOADS: 'cleanupPendingUploads',
  PURGE_EXPIRED_FILES: 'purgeExpiredSoftDeletedFiles',
})

const QUEUE_NAME = 'maintenance'

const enqueueMaintenance = (job, data = {}) => publishJob(QUEUE_NAME, job, data)

module.exports = { QUEUE_NAME, MAINTENANCE_JOBS, enqueueMaintenance }