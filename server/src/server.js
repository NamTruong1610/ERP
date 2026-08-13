require('dotenv').config()
const { app } = require('./app')
const { validateEnv } = require('./config/validateEnv')
validateEnv()

const { connect } = require('./bootstrap/connections')
const { initRateLimiters } = require('./middlewares/rateLimitMiddleware')
const { runSeeds } = require('./bootstrap/seed')
const { registerShutdown } = require('./bootstrap/shutdown')
const { startEmailWorker } = require('./workers/emailWorker')
const { startMaintenanceWorker } = require('./workers/maintenanceWorker')
const { startJobs } = require('./jobs')

const PORT = process.env.PORT || 5500

const startServer = async () => {
  await connect()
  initRateLimiters()

  const emailWorker = await startEmailWorker()
  const maintenanceWorker = await startMaintenanceWorker()

  await runSeeds()

  const server = app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

  const cronTasks = await startJobs()

  registerShutdown({
    server,
    jobs: cronTasks,
    workers: [emailWorker, maintenanceWorker],
  })
}

startServer()