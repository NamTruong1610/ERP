const { Worker } = require('bullmq')
const { bullConnection } = require('../config/queueConfig')
const { MAINTENANCE_JOBS } = require('../queues/maintenanceQueue')

const { cleanupExpiredUsers } = require('../jobs/cleanupExpiredUsers')
const { cleanupPendingUploads } = require('../jobs/cleanupPendingUploads')
const { purgeExpiredSoftDeletedFiles } = require('../jobs/purgeExpiredFiles')

const handlers = {
  [MAINTENANCE_JOBS.CLEANUP_EXPIRED_USERS]: () => cleanupExpiredUsers(),
  [MAINTENANCE_JOBS.CLEANUP_PENDING_UPLOADS]: () => cleanupPendingUploads(),
  [MAINTENANCE_JOBS.PURGE_EXPIRED_FILES]: () => purgeExpiredSoftDeletedFiles(),
}

let worker

const startMaintenanceWorker = () => {
  if (worker) return worker

  worker = new Worker(
    'maintenance',
    async (job) => {
      const handler = handlers[job.name]
      if (!handler) {
        throw new Error(`No handler for maintenance job "${job.name}"`)
      }
      await handler()
    },
    {
      connection: bullConnection,
      // Sweeps are heavy and self-contained; one at a time is plenty and keeps
      // a long purge from overlapping the next hourly tick.
      concurrency: 1,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`Maintenance job ${job?.id} (${job?.name}) failed:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`Maintenance job ${job.id} (${job.name}) done`)
  })

  return worker
}

module.exports = { startMaintenanceWorker }