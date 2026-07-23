const cron = require('node-cron')

const { cleanupExpiredUsers } = require('./cleanupExpiredUsers')
const { cleanupPendingUploads } = require('./cleanupPendingUploads')
const { purgeExpiredSoftDeletedFiles } = require('./purgeExpiredFiles')

// Returns the scheduled task handles so shutdown can stop them.
exports.startJobs = async () => {
  // Run immediately on startup
  await cleanupExpiredUsers()
  await cleanupPendingUploads()
  await purgeExpiredSoftDeletedFiles()

  // Run every hour — expired (unactivated) user accounts
  const expiredUsersJob = cron.schedule('0 * * * *', async () => {
    await cleanupExpiredUsers()
  })

  // Run once daily at 3am — permanently purge files that have been
  // soft-deleted past the retention window (DB row + R2 object)
  const purgeFilesJob = cron.schedule('0 3 * * *', async () => {
    await purgeExpiredSoftDeletedFiles()
  })

  return [expiredUsersJob, purgeFilesJob]
}