const { Worker } = require('bullmq')
const { bullConnection } = require('../config/queueConfig')
const { EMAIL_JOBS } = require('../queues/emailQueue')
const {
  sendAccountActivationEmail,
  sendAccountRecoveryEmail,
  sendEmailChangeVerificationEmail,
} = require('../utils/emailUtils')

// Job name -> the actual Resend sender. The senders are unchanged; the worker
// is just the thing that now calls them, off the request path, with retries.
const handlers = {
  [EMAIL_JOBS.ACTIVATION]: ({ email, tokenId }) => sendAccountActivationEmail(email, tokenId),
  [EMAIL_JOBS.RECOVERY]: ({ email, tokenId }) => sendAccountRecoveryEmail(email, tokenId),
  [EMAIL_JOBS.EMAIL_CHANGE]: ({ email, tokenId }) => sendEmailChangeVerificationEmail(email, tokenId),
}

let worker

const startEmailWorker = () => {
  if (worker) return worker

  worker = new Worker(
    'emails',
    async (job) => {
      const handler = handlers[job.name]
      if (!handler) {
        // Unknown job name — fail fast rather than retry five times on
        // something no version of this worker can handle.
        throw new Error(`No handler for email job "${job.name}"`)
      }
      await handler(job.data)
    },
    {
      connection: bullConnection,
      // Emails are I/O-bound and Resend tolerates parallelism. A handful at a
      // time drains any backlog without hammering the provider.
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    // After `attempts` are exhausted the job lands in the failed set (kept
    // briefly per removeOnFail) for inspection / manual replay.
    console.error(`Email job ${job?.id} (${job?.name}) failed:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`Email job ${job.id} (${job.name}) sent`)
  })

  return worker
}

module.exports = { startEmailWorker }