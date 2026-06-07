const { prisma } = require('../config/PrismaConfig')
const { MFA_SETUP_TTL_SECONDS } = require('../config/constants')

exports.findMfaByUserId = async (userId) => {
  return await prisma.userMfa.findUnique({
    where: { userId }
  })
}

exports.updateMfa = async (userId, data) => {
  return await prisma.userMfa.update({
    where: { userId },
    data
  })
}