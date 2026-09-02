import 'dotenv/config';
import * as appNs from './app.js';
import * as validateEnvNs from './config/validateEnv.js';
validateEnvNs.validateEnv()

import * as connections from './bootstrap/connections.js';
import * as rateLimitMiddleware from './middlewares/rateLimit.middleware.js';
import * as seed from './bootstrap/seed.js';
import * as shutdown from './bootstrap/shutdown.js';
import * as emailWorker from './workers/email.worker.js';
import * as maintenanceWorker from './workers/maintenance.worker.js';
import * as webhookWorker from './workers/webhook.worker.js';
import * as index from './jobs/index.js';
const PORT = process.env.PORT || 5500

const startServer = async () => {
  await connections.connect()
  rateLimitMiddleware.initRateLimiters()

  const emailWorkerHandle = await emailWorker.startEmailWorker()
  const maintenanceWorkerHandle = await maintenanceWorker.startMaintenanceWorker()
  const webhookWorkerHandle = await webhookWorker.startWebhookWorker()

  await seed.runSeeds()

  const server = appNs.app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

  const cronTasks = await index.startJobs()

  shutdown.registerShutdown({
    server,
    jobs: cronTasks,
    workers: [emailWorkerHandle, maintenanceWorkerHandle, webhookWorkerHandle],
  })
}

startServer()