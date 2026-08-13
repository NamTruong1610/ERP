const { redisClient } = require('../config/RedisConfig')

// Acquires a short-lived Redis lock keyed to this tick so that only ONE
// instance in a multi-instance deploy actually enqueues the job. node-cron
// fires on every instance independently; only the first to SET NX wins the
// lock and does the enqueue. Reuses the existing node-redis client (still
// there for sessions) rather than pulling in a RabbitMQ scheduler plugin.
const runOnce = async (lockKey, ttlSeconds, fn) => {
  const acquired = await redisClient.set(lockKey, '1', { NX: true, EX: ttlSeconds })
  if (!acquired) return
  await fn()
}

module.exports = { runOnce }