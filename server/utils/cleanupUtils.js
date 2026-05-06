const { prisma } = require('../config/PrismaConfig')

exports.cleanupExpiredUsers = async () => {
  const deleted = await prisma.user.deleteMany({
    where: {
      expiresAt: {
        lt: new Date() // less than now = expired
      }
    }
  })
  console.log(`Cleaned up ${deleted.count} expired users`)
}