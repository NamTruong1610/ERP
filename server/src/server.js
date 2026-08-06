require('dotenv').config()
const { app } = require('./app')
const { validateEnv } = require('./config/validateEnv')
validateEnv()

const { connect } = require('./bootstrap/connections')
const { runSeeds } = require('./bootstrap/seed')
const { registerShutdown } = require('./bootstrap/shutdown')
const { startEmailWorker } = require('./workers/emailWorker')
const { startMaintenanceWorker } = require('./workers/maintenanceWorker')
const { startJobs } = require('./jobs')

const PORT = process.env.PORT || 5500

const startServer = async () => {
  await connect()

  const emailWorker = startEmailWorker()
  const maintenanceWorker = startMaintenanceWorker()

  await runSeeds()

  const server = app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

  // Registers schedules + enqueues catch-up. Workers are already up to consume.
  await startJobs()

  registerShutdown({
    server,
    workers: [emailWorker, maintenanceWorker],
  })
}

startServer()