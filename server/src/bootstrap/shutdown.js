import * as connections from './connections.js';
const SHUTDOWN_TIMEOUT_MS = 15_000

export const registerShutdown = ({ server, jobs = [], workers = [] }) => {
  let shuttingDown = false

  const shutdown = async (signal) => {
    // Two Ctrl+Cs shouldn't start two shutdowns
    if (shuttingDown) return
    shuttingDown = true

    console.log(`${signal} received — shutting down`)

    // Hard ceiling. If a hung connection blocks the drain forever, exit
    // anyway rather than hang until the host force-kills us at a random
    // point. unref() so this timer alone can't keep the process alive.
    const forceExit = setTimeout(() => {
      console.error('Shutdown timed out, forcing exit')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    forceExit.unref()

    try {
      // 1. Stop cron from starting anything new.
      jobs.forEach(task => task.stop())

      // 2. Stop accepting new connections. Existing requests keep running;
      //    the callback fires once the last one finishes.
      await new Promise((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()))
      })

      // 3. Let BullMQ finish the job it's mid-way through.
      await Promise.allSettled(workers.map(w => w.close()))

      // 4. Postgres and Redis last — everything above still needs them
      //    while it finishes.
      await connections.disconnect()

      console.log('Shutdown complete')
      clearTimeout(forceExit)
      process.exit(0)
    } catch (err) {
      console.error('Error during shutdown', err)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))  // deploys, docker stop
  process.on('SIGINT', () => shutdown('SIGINT'))    // Ctrl+C
}