// dotenv must run before anything reads process.env — app.js reads
// CLIENT_URL when it loads, so this has to come first
require('dotenv').config()

const { validateEnv } = require('./config/validateEnv')
validateEnv()

const cron = require('node-cron')

const { app } = require('./app')
const { prismaConnect } = require('./config/PrismaConfig')
const { redisConnect } = require('./config/RedisConfig')
const { startEmailWorker } = require('./workers/emailWorker')
const { seedAdminUser, seedSuperAdminUser } = require('./utils/seedUtils')
const { cleanupExpiredUsers, purgeExpiredSoftDeletedFiles } = require('./utils/cleanupUtils')
const { cleanupPendingUploads } = require('./repositories/fileRepository')

const PORT = process.env.PORT || 5500

const startServer = async () => {
  await prismaConnect()
  await redisConnect()

  startEmailWorker()

  await seedAdminUser()
  await seedSuperAdminUser()

  app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

  // Run immediately on startup
  await cleanupExpiredUsers()
  await cleanupPendingUploads()
  await purgeExpiredSoftDeletedFiles()

  // Run every hour — expired (unactivated) user accounts
  cron.schedule('0 * * * *', async () => {
    await cleanupExpiredUsers()
  })

  // Run once daily at 3am — permanently purge files that have been
  // soft-deleted past the retention window (DB row + R2 object)
  cron.schedule('0 3 * * *', async () => {
    await purgeExpiredSoftDeletedFiles()
  })
}

startServer()