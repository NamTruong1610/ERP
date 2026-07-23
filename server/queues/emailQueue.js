const { Queue } = require('bullmq')
const { bullConnection } = require('../config/queueConfig')

// Job names — the worker switches on these to pick the right template.
const EMAIL_JOBS = Object.freeze({
  ACTIVATION: 'activation',
  RECOVERY: 'recovery',
  EMAIL_CHANGE: 'emailChange',
})

const emailQueue = new Queue('emails', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    // Raw tokens travel in the payload (they're hashed at rest in the DB and
    // cannot be re-fetched), so we don't keep jobs around with the secret in
    // them longer than necessary. Completed jobs are dropped immediately;
    // failed jobs are kept briefly for inspection, then aged out.
    removeOnComplete: true,
    removeOnFail: { age: 24 * 3600, count: 100 },
  },
})

// Deliberately no jobId-based dedupe here. Rapid duplicate sends are already
// prevented upstream — the activation resend has its cooldown window, and the
// recovery / email-change flows are gated by their Redis token maps. Keying
// jobId on the email would also wrongly collapse a legitimate second request
// (e.g. a user asking for another reset link) into the first.
//
// enqueue returns as soon as the job is durably in Redis. Callers await it
// (it's fast) so a Redis outage surfaces as an error at the call site rather
// than an email that silently vanishes.
const enqueueEmail = (job, data) => emailQueue.add(job, data)

module.exports = { emailQueue, enqueueEmail, EMAIL_JOBS }