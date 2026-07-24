const { prisma, prismaConnect } = require('../config/PrismaConfig')
const { redisClient, redisConnect } = require('../config/RedisConfig')

exports.connect = async () => {
  await prismaConnect()
  await redisConnect()
}

exports.disconnect = async () => {
  // allSettled — if Postgres is already gone, Redis should still close
  await Promise.allSettled([
    prisma.$disconnect(),
    redisClient.quit(),
  ])
}