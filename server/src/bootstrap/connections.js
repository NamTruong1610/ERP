const { prisma, prismaConnect } = require('../config/PrismaConfig')
const { redisClient, redisConnect } = require('../config/RedisConfig')
const { rabbitConnect, rabbitDisconnect } = require('../config/RabbitConfig')

exports.connect = async () => {
  await prismaConnect()
  await redisConnect()
  await rabbitConnect()
}

exports.disconnect = async () => {
  // allSettled — if Postgres is already gone, Redis should still close
  await Promise.allSettled([
    prisma.$disconnect(),
    redisClient.quit(),
    rabbitDisconnect(),
  ])
}