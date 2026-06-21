const { prisma } = require('../config/PrismaConfig')

exports.createAuditLog = async (data, client = prisma) => {
  return await client.auditLog.create({ data })
}