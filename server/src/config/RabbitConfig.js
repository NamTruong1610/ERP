const amqp = require('amqplib')

// Single shared connection + confirm channel for the whole process, mirroring
// the old bullConnection pattern. A confirm channel means publish() only
// resolves once the broker has acked receipt — the same "durably queued
// before we return" guarantee BullMQ gave callers over Redis.
let connection
let channel

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://127.0.0.1:5672'

const rabbitConnect = async () => {
  if (channel) return channel

  connection = await amqp.connect(RABBIT_URL)
  connection.on('error', (err) => {
    console.error('RabbitMQ connection error:', err.message)
  })
  connection.on('close', () => {
    console.error('RabbitMQ connection closed')
  })

  channel = await connection.createConfirmChannel()
  channel.on('error', (err) => {
    console.error('RabbitMQ channel error:', err.message)
  })

  return channel
}

const rabbitDisconnect = async () => {
  await Promise.allSettled([
    channel?.close(),
    connection?.close(),
  ])
  channel = undefined
  connection = undefined
}

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized — call rabbitConnect() during bootstrap')
  }
  return channel
}

module.exports = { rabbitConnect, rabbitDisconnect, getChannel }