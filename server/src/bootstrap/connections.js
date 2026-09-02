import * as prismaConfig from '../config/prisma.config.js';
import * as redisConfig from '../config/redis.config.js';
import * as rabbitConfig from '../config/rabbit.config.js';
export const connect = async () => {
  await prismaConfig.prismaConnect()
  await redisConfig.redisConnect()
  await rabbitConfig.rabbitConnect()
}

export const disconnect = async () => {
  // allSettled — if Postgres is already gone, Redis should still close
  await Promise.allSettled([
    prismaConfig.prisma.$disconnect(),
    redisConfig.redisClient.quit(),
    rabbitConfig.rabbitDisconnect(),
  ])
}