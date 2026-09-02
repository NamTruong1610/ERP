import * as prismaConfig from '../config/prisma.config.js';
import * as constants from '../config/constants.js';
export const findMfaByUserId = async (userId) => {
  return await prismaConfig.prisma.userMfa.findUnique({
    where: { userId }
  })
}

export const createUserMfa = async (userId, data, client = prismaConfig.prisma) => {
  return await client.userMfa.create({
    data: { ...data, userId }
  })
}

export const upsertUserMfa = async (userId, data, client = prismaConfig.prisma) => {
  return await client.userMfa.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data
  })
}

export const updateMfa = async (userId, data, client = prismaConfig.prisma) => {
  return await client.userMfa.update({
    where: { userId },
    data
  })
}

export const deleteMfa = async (userId, client = prismaConfig.prisma) => {
  return await client.userMfa.delete({
    where: { userId }
  })
}