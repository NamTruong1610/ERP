import * as retryableQueue from '../lib/queue/retryable.queue.js';
import * as webhookQueue from '../queues/webhook.queue.js';
import * as webhookProcessingService from '../services/webhookProcessing.service.js';
const handlers = {
  [webhookQueue.WEBHOOK_JOBS.STRIPE_EVENT]: ({ webhookEventId }) => webhookProcessingService.processStripeWebhookEventService(webhookEventId),
}

const startWebhookWorker = () =>
  retryableQueue.consumeWithRetry(webhookQueue.QUEUE_NAME, handlers, {
    maxAttempts: 3,
    baseDelayMs: 30_000,
    concurrency: 1,
  })

export { startWebhookWorker };