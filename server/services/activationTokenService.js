const { prisma } = require('../config/PrismaConfig')
const { ACTIVATION_TTL_MS } = require('../config/constants')

exports.createUserActivation = async (userId, hashedTokenId) => {
  return await prisma.userActivation.create({
    data: {
      userId,
      tokenId: hashedTokenId,
      expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS)
    }
  })
}

exports.findUserActivationByTokenId = async (tokenId) => {
  return await prisma.userActivation.findUnique({
    where: { tokenId }
  })
}

exports.deleteUserActivation = async (userId) => {
  return await prisma.userActivation.delete({
    where: { userId }
  })
}