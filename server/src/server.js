require('dotenv').config()

const { validateEnv } = require('./config/validateEnv')
validateEnv()

const cron = require('node-cron')

const { app } = require('./app')
const { connect } = require('./bootstrap/connections')
const { runSeeds } = require('./bootstrap/seed')
const { registerShutdown } = require('./bootstrap/shutdown')
const { startEmailWorker } = require('./workers/emailWorker')
const { cleanupExpiredUsers, purgeExpiredSoftDeletedFiles } = require('./utils/cleanupUtils')
const { cleanupPendingUploads } = require('./repositories/fileRepository')

const PORT = process.env.PORT || 5500

const startServer = async () => {
  await connect()

  const emailWorker = startEmailWorker()

  await runSeeds()

  const server = app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

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

  registerShutdown({
    server,
    jobs: [expiredUsersJob, purgeFilesJob],
    workers: [emailWorker],
  })
}

startServer()