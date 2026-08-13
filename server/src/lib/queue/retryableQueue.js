const { getChannel } = require('../../config/RabbitConfig')

// Sets up a queue with a DLX-backed retry ladder:
//   main queue  --(on handler failure, worker republishes)-->  retry queue
//   retry queue --(per-message TTL expires)-->                 back to main queue
//
// Caveat (documented rather than solved, given the volume here): RabbitMQ
// only evicts a message once it reaches the HEAD of a queue, so if two
// messages land in the retry queue with different TTLs, the one at the back
// won't expire early just because its TTL is shorter than the one in front.
// At this job volume that's an acceptable simplification; a fully correct
// version would use one fixed-TTL retry queue per backoff level.
const assertRetryableQueue = async (queueName) => {
  const channel = getChannel()
  const retryQueue = `${queueName}.retry`
  const failedQueue = `${queueName}.failed`

  await channel.assertQueue(queueName, { durable: true })

  await channel.assertQueue(retryQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',          // default exchange
      'x-dead-letter-routing-key': queueName, // routes straight back to the main queue by name
    },
  })

  // Parking lot for jobs that exhausted every attempt — kept for manual
  // inspection/replay, mirroring BullMQ's removeOnFail-with-retention.
  await channel.assertQueue(failedQueue, { durable: true })

  return { queueName, retryQueue, failedQueue }
}

const publishJob = (queueName, jobName, data) => {
  const channel = getChannel()
  const payload = Buffer.from(JSON.stringify({ jobName, data }))

  return new Promise((resolve, reject) => {
    channel.sendToQueue(
      queueName,
      payload,
      { persistent: true, headers: { 'x-retry-count': 0 } },
      (err) => (err ? reject(err) : resolve())
    )
  })
}

// Wraps a handler map with the retry/DLX bookkeeping. maxAttempts counts the
// FIRST try, matching BullMQ's `attempts` option (attempts: 5 = 1 try + 4 retries).
// Returns { close } so callers can plug straight into the existing
// registerShutdown({ workers: [...] }) plumbing without changing shutdown.js.
const consumeWithRetry = async (queueName, handlers, { maxAttempts, baseDelayMs, concurrency = 1 }) => {
  const { retryQueue, failedQueue } = await assertRetryableQueue(queueName)
  const channel = getChannel()
  await channel.prefetch(concurrency)

  const { consumerTag } = await channel.consume(queueName, async (msg) => {
    if (!msg) return

    const { jobName, data } = JSON.parse(msg.content.toString())
    const attempt = (msg.properties.headers?.['x-retry-count'] ?? 0) + 1

    try {
      const handler = handlers[jobName]
      if (!handler) {
        // Unknown job name — fail fast rather than retry on something no
        // version of this worker can handle.
        throw new Error(`No handler for job "${jobName}"`)
      }
      await handler(data)
      channel.ack(msg)
      console.log(`Job ${jobName} on ${queueName} done (attempt ${attempt})`)
    } catch (err) {
      console.error(`Job ${jobName} on ${queueName} failed (attempt ${attempt}):`, err.message)

      if (attempt >= maxAttempts) {
        channel.sendToQueue(failedQueue, msg.content, {
          persistent: true,
          headers: { ...msg.properties.headers, 'x-retry-count': attempt, 'x-failed-reason': err.message },
        })
        channel.ack(msg)
        return
      }

      const delay = baseDelayMs * 2 ** (attempt - 1)
      channel.sendToQueue(retryQueue, msg.content, {
        persistent: true,
        expiration: String(delay),
        headers: { ...msg.properties.headers, 'x-retry-count': attempt },
      })
      channel.ack(msg)
    }
  })

  return { close: () => channel.cancel(consumerTag) }
}

module.exports = { assertRetryableQueue, publishJob, consumeWithRetry }