const { consumeWithRetry } = require('../lib/queue/retryableQueue')
const { QUEUE_NAME, WEBHOOK_JOBS } = require('../queues/webhookQueue')

// TODO: replace with the real Stripe event processor once the webhook
// idempotency inbox pattern lands.
const handlers = {
  [WEBHOOK_JOBS.STRIPE_EVENT]: async () => {
    throw new Error('Stripe webhook handler not yet implemented')
  },
}

const startWebhookWorker = () =>
  consumeWithRetry(QUEUE_NAME, handlers, {
    maxAttempts: 3,
    baseDelayMs: 30_000,
    concurrency: 1,
  })

module.exports = { startWebhookWorker }