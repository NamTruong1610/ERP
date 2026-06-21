const { prisma } = require('../config/PrismaConfig')
const { ACTIVATION_TTL_MS } = require('../config/constants')

exports.createUserActivation = async (userId, hashedTokenId, client = prisma) => {
  return await client.userActivation.create({
    data: {
      userId,
      tokenId: hashedTokenId,
      expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS)
    }
  })
}

exports.updateUserActivation = async (userId, data, client = prisma) => {
  return await client.userActivation.update({
    where: { userId },
    data
  })
}

exports.findUserActivationByTokenId = async (tokenId) => {
  return await prisma.userActivation.findUnique({
    where: { tokenId }
  })
}

exports.deleteUserActivation = async (userId, client = prisma) => {
  return await client.userActivation.delete({
    where: { userId }
  })
}