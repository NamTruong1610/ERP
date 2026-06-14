const { prisma } = require('../config/PrismaConfig')
const { MFA_SETUP_TTL_SECONDS } = require('../config/constants')

exports.findMfaByUserId = async (userId) => {
  return await prisma.userMfa.findUnique({
    where: { userId }
  })
}

exports.createUserMfa = async (userId, data) => {
  return await prisma.userMfa.create({
    data: { ...data, userId }
  })
}

exports.upsertUserMfa = async (userId, data) => {
  return await prisma.userMfa.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data
  })
}

exports.updateMfa = async (userId, data) => {
  return await prisma.userMfa.update({
    where: { userId },
    data
  })
}

exports.deleteMfa = async (userId) => {
  return await prisma.userMfa.delete({
    where: { userId }
  })
}