import * as prismaConfig from '../config/prisma.config.js';
export const cleanupExpiredUsers = async () => {
  // Find expired activations
  const expiredActivations = await prismaConfig.prisma.userActivation.findMany({
    where: {
      expiresAt: { lt: new Date() }
    },
    select: { userId: true }
  })

  if (expiredActivations.length === 0) {
    console.log('Cleaned up 0 expired users')
    return
  }

  const expiredUserIds = expiredActivations.map(a => a.userId)

  // Delete the users — UserActivation cascades automatically
  const deleted = await prismaConfig.prisma.user.deleteMany({
    where: {
      id: { in: expiredUserIds }
    }
  })

  console.log(`Cleaned up ${deleted.count} expired users`)
}