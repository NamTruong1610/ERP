const IORedis = require('ioredis')

// Dedicated connection for BullMQ. The app's primary Redis client
// (config/RedisConfig.js) uses node-redis, which BullMQ cannot drive —
// BullMQ needs ioredis with blocking commands enabled, so it gets its own
// connection here. Shared by every queue and worker (email now, webhooks
// and notifications later) rather than opening one connection per queue.
const bullConnection = new IORedis(
  process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  {
    // Required by BullMQ. Its workers issue long-lived blocking reads
    // (BRPOPLPUSH) that must never be abandoned; node-redis-style retry
    // ceilings would kill them. null = never give up on a command.
    maxRetriesPerRequest: null,
  }
)

bullConnection.on('error', (err) => {
  console.error('BullMQ Redis Error:', err.message)
})

module.exports = { bullConnection }