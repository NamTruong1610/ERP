require('dotenv').config()

const { validateEnv } = require('./config/validateEnv')
validateEnv()

const { connect } = require('./bootstrap/connections')
const { runSeeds } = require('./bootstrap/seed')
const { registerShutdown } = require('./bootstrap/shutdown')
const { startEmailWorker } = require('./workers/emailWorker')
const { startJobs } = require('./jobs')

const PORT = process.env.PORT || 5500

const startServer = async () => {
  await connect()

  const { app } = require('./app')

  const emailWorker = startEmailWorker()

  await runSeeds()

  const server = app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

  const jobs = await startJobs()

  registerShutdown({
    server,
    jobs,
    workers: [emailWorker],
  })
}

startServer()