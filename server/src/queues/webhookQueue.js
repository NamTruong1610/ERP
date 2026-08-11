const { Queue } = require('bullmq')
const { bullConnection } = require('../config/queueConfig')

const webhookQueue = new Queue('webhook', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: true,
    removeOnFail: { age: 7 * 24 * 3600, count: 50 },
  },
})

