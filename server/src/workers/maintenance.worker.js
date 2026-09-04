import * as retryableQueue from '../lib/queue/retryable.queue.js';
import * as maintenanceQueue from '../queues/maintenance.queue.js';
import * as cleanupExpiredUsersNs from '../jobs/cleanupExpiredUsers.js';
import * as cleanupPendingUploadsNs from '../jobs/cleanupPendingUploads.js';
import * as purgeExpiredFiles from '../jobs/purgeExpiredFiles.js';
import * as reconciliationService from '../services/reconciliation.service.js';
const handlers = {
  [maintenanceQueue.MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS]: () => cleanupExpiredUsersNs.cleanupExpiredUsers(),
  [maintenanceQueue.MAINTENANCE_JOBS.CLEANUP_PENDING_UPLOADS]: () => cleanupPendingUploadsNs.cleanupPendingUploads(),
  [maintenanceQueue.MAINTENANCE_JOBS.PURGE_EXPIRED_FILES]: () => purgeExpiredFiles.purgeExpiredSoftDeletedFiles(),
  [maintenanceQueue.MAINTENANCE_JOBS.RECONCILE_STALE_PAYMENT_ATTEMPTS]: () => reconciliationService.reconcileStalePaymentAttemptsService(),
  [maintenanceQueue.MAINTENANCE_JOBS.CHECK_WEBHOOK_DLQ_DEPTH]: () => reconciliationService.checkWebhookDlqDepthService(), 

}

const startMaintenanceWorker = () =>
  retryableQueue.consumeWithRetry(maintenanceQueue.QUEUE_NAME, handlers, {
    maxAttempts: 3,
    baseDelayMs: 30_000,
    concurrency: 1, // one sweep at a time, same as before
  })

export { startMaintenanceWorker };