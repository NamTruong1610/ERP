import * as retryableQueue from '../lib/queue/retryable.queue.js';
const MAINTENANCE_JOBS = Object.freeze({
  CLEANUP_EXPIRED_USERS: 'cleanupExpiredUsers',
  CLEANUP_PENDING_UPLOADS: 'cleanupPendingUploads',
  PURGE_EXPIRED_FILES: 'purgeExpiredSoftDeletedFiles',
  RECONCILE_STALE_PAYMENT_ATTEMPTS: 'reconcileStalePaymentAttempts',
  CHECK_WEBHOOK_DLQ_DEPTH: 'checkWebhookDlqDepth',
})

const QUEUE_NAME = 'maintenance'

const enqueueMaintenance = (job, data = {}) => retryableQueue.publishJob(QUEUE_NAME, job, data)

export { QUEUE_NAME, MAINTENANCE_JOBS, enqueueMaintenance };