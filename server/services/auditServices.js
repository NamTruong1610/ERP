const { prisma } = require('../config/PrismaConfig')

exports.createAuditLog = async (data) => {
  return await prisma.auditLog.create({ data })
}