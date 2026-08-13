const { consumeWithRetry } = require('../lib/queue/retryableQueue')
const { QUEUE_NAME, EMAIL_JOBS } = require('../queues/emailQueue')
const {
  sendAccountActivationEmail,
  sendAccountRecoveryEmail,
  sendEmailChangeVerificationEmail,
} = require('../lib/email/mailer')

const handlers = {
  [EMAIL_JOBS.ACTIVATION]: ({ email, tokenId }) => sendAccountActivationEmail(email, tokenId),
  [EMAIL_JOBS.RECOVERY]: ({ email, tokenId }) => sendAccountRecoveryEmail(email, tokenId),
  [EMAIL_JOBS.EMAIL_CHANGE]: ({ email, tokenId }) => sendEmailChangeVerificationEmail(email, tokenId),
}

const startEmailWorker = () =>
  consumeWithRetry(QUEUE_NAME, handlers, {
    maxAttempts: 5,
    baseDelayMs: 2000,
    concurrency: 5,
  })

module.exports = { startEmailWorker }