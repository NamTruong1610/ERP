import * as retryableQueue from '../lib/queue/retryable.queue.js';
const EMAIL_JOBS = Object.freeze({
  ACTIVATION: 'activation',
  RECOVERY: 'recovery',
  EMAIL_CHANGE: 'emailChange',
})

const QUEUE_NAME = 'emails'

// enqueueEmail resolves once the broker confirms receipt. Callers await it
// (it's fast) so a RabbitMQ outage surfaces as an error at the call site
// rather than an email that silently vanishes — same contract as before.
const enqueueEmail = (job, data) => retryableQueue.publishJob(QUEUE_NAME, job, data)

export { QUEUE_NAME, enqueueEmail, EMAIL_JOBS };