const { registerMaintenanceSchedules, enqueueStartupCatchup } = require('../queues/maintenanceQueue')

// Registers the recurring schedules in Redis (deduped across instances) and
// enqueues the one-off startup catch-up. The actual work runs on the
// maintenance worker, not here.
exports.startJobs = async () => {
  await registerMaintenanceSchedules()
  await enqueueStartupCatchup()
}