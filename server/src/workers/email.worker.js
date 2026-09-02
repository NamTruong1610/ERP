import * as retryableQueue from '../lib/queue/retryable.queue.js';
import * as emailQueue from '../queues/email.queue.js';
import * as mailer from '../lib/email/mailer.js';
const handlers = {
  [emailQueue.EMAIL_JOBS.ACTIVATION]: ({ email, tokenId }) => mailer.sendAccountActivationEmail(email, tokenId),
  [emailQueue.EMAIL_JOBS.RECOVERY]: ({ email, tokenId }) => mailer.sendAccountRecoveryEmail(email, tokenId),
  [emailQueue.EMAIL_JOBS.EMAIL_CHANGE]: ({ email, tokenId }) => mailer.sendEmailChangeVerificationEmail(email, tokenId),
}

const startEmailWorker = () =>
  retryableQueue.consumeWithRetry(emailQueue.QUEUE_NAME, handlers, {
    maxAttempts: 5,
    baseDelayMs: 2000,
    concurrency: 5,
  })

export { startEmailWorker };