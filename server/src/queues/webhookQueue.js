const { publishJob } = require('../lib/queue/retryableQueue')

const WEBHOOK_JOBS = Object.freeze({
  STRIPE_EVENT: 'stripeEvent',
})

const QUEUE_NAME = 'webhook'

const enqueueWebhookEvent = (data) => publishJob(QUEUE_NAME, WEBHOOK_JOBS.STRIPE_EVENT, data)

module.exports = { QUEUE_NAME, WEBHOOK_JOBS, enqueueWebhookEvent }