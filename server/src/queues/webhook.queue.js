import * as retryableQueue from '../lib/queue/retryable.queue.js';
const WEBHOOK_JOBS = Object.freeze({
  STRIPE_EVENT: 'stripeEvent',
})

const QUEUE_NAME = 'webhook'

const enqueueWebhookEvent = (data) => retryableQueue.publishJob(QUEUE_NAME, WEBHOOK_JOBS.STRIPE_EVENT, data)

export { QUEUE_NAME, WEBHOOK_JOBS, enqueueWebhookEvent };