import * as prismaConfig from '../config/prisma.config.js';
import * as constants from '../config/constants.js';
export const createUserActivation = async (userId, hashedTokenId, client = prismaConfig.prisma) => {
  return await client.userActivation.create({
    data: {
      userId,
      tokenId: hashedTokenId,
      expiresAt: new Date(Date.now() + constants.ACTIVATION_TTL_MS)
    }
  })
}

export const updateUserActivation = async (userId, data, client = prismaConfig.prisma) => {
  return await client.userActivation.update({
    where: { userId },
    data
  })
}

export const findUserActivationByTokenId = async (tokenId) => {
  return await prismaConfig.prisma.userActivation.findUnique({
    where: { tokenId }
  })
}

export const deleteUserActivation = async (userId, client = prismaConfig.prisma) => {
  return await client.userActivation.delete({
    where: { userId }
  })
}