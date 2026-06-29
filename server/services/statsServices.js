const { prisma } = require('../config/PrismaConfig')
const { redisClient } = require('../config/RedisConfig')
const { CACHE_TTL_SECONDS } = require('../config/constants')

const TZ = process.env.CLINIC_TIMEZONE || 'Australia/Sydney'

const getCached = async (key) => {
  const raw = await redisClient.get(key)
  return raw ? JSON.parse(raw) : null
}

const setCache = async (key, value) => {
  await redisClient.set(key, JSON.stringify(value), { EX: CACHE_TTL_SECONDS })
}

const getDateBounds = async () => {
  const [today, week] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        date_trunc('day', NOW() AT TIME ZONE ${TZ})
          AT TIME ZONE ${TZ} AS start,
        (date_trunc('day', NOW() AT TIME ZONE ${TZ}) + INTERVAL '1 day')
          AT TIME ZONE ${TZ} AS "end"
    `,
    prisma.$queryRaw`
      SELECT
        date_trunc('week', NOW() AT TIME ZONE ${TZ})
          AT TIME ZONE ${TZ} AS start,
        (date_trunc('week', NOW() AT TIME ZONE ${TZ}) + INTERVAL '1 week')
          AT TIME ZONE ${TZ} AS "end"
    `
  ])

  return {
    todayStart: today[0].start,
    todayEnd: today[0].end,
    weekStart: week[0].start,
    weekEnd: week[0].end
  }
}


exports.getMyStats = async (userId) => {
  const cacheKey = `stats:me:${userId}`
  const cached   = await getCached(cacheKey)
  if (cached) return cached

  const { todayStart, todayEnd, weekStart, weekEnd } = await getDateBounds()

  const [
    appointmentsToday,
    appointmentsThisWeek,
    uniquePatients,
    recentActivity
  ] = await Promise.all([
    prisma.appointment.count({
      where: {
        dentistId: userId,
        deletedAt: null,
        date: { gte: todayStart, lt: todayEnd }
      }
    }),
    prisma.appointment.count({
      where: {
        dentistId: userId,
        deletedAt: null,
        date: { gte: weekStart, lt: weekEnd }
      }
    }),
    prisma.appointment.findMany({
      where:    { dentistId: userId, deletedAt: null },
      select:   { patientId: true },
      distinct: ['patientId']
    }).then(rows => rows.length),
    prisma.auditLog.findMany({
      where:   { actorId: userId },
      orderBy: { createdAt: 'desc' },
      take:    5,
      select: {
        action:     true,
        targetType: true,
        createdAt:  true,
        metadata:   true
      }
    })
  ])

  const stats = {
    appointmentsToday,
    appointmentsThisWeek,
    uniquePatients,
    recentActivity,
    cachedAt: new Date().toISOString()
  }

  await setCache(cacheKey, stats)
  return stats
}

exports.getClinicStats = async () => {
  const cacheKey = 'stats:clinic'
  const cached   = await getCached(cacheKey)
  if (cached) return cached

  const { todayStart, todayEnd, weekStart, weekEnd } = await getDateBounds()

  const [
    totalPatients,
    totalActiveUsers,
    pendingActivations,
    appointmentsToday,
    appointmentsThisWeek,
    appointmentsByStatus,
    recentPatients
  ] = await Promise.all([
    prisma.patient.count({
      where: { deletedAt: null }
    }),
    prisma.user.count({
      where: { status: 'ACTIVE', deletedAt: null }
    }),
    prisma.user.count({
      where: { status: 'PENDING_ACTIVATION', deletedAt: null }
    }),
    prisma.appointment.count({
      where: {
        deletedAt: null,
        date: { gte: todayStart, lt: todayEnd }
      }
    }),
    prisma.appointment.count({
      where: {
        deletedAt: null,
        date: { gte: weekStart, lt: weekEnd }
      }
    }),

    prisma.appointment.groupBy({
      by:     ['status'],
      where:  { deletedAt: null },
      _count: { status: true }
    }),
    prisma.patient.findMany({
      where:   { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take:    5,
      select: {
        id:        true,
        firstName: true,
        lastName:  true,
        createdAt: true
      }
    })
  ])

  const stats = {
    totalPatients,
    totalActiveUsers,
    pendingActivations,
    appointmentsToday,
    appointmentsThisWeek,
    appointmentsByStatus: appointmentsByStatus.reduce((acc, row) => {
      acc[row.status] = row._count.status
      return acc
    }, {}),
    recentPatients,
    cachedAt: new Date().toISOString()
  }

  await setCache(cacheKey, stats)
  return stats
}


exports.getSystemStats = async () => {
  const cacheKey = 'stats:system'
  const cached   = await getCached(cacheKey)
  if (cached) return cached

  const { todayStart, todayEnd } = await getDateBounds()

  const [
    activeSessions,
    failedLoginsToday,
    totalFiles,
    storageAggregate,
    auditLogsToday
  ] = await Promise.all([
    redisClient.keys('session:*').then(keys => keys.length),
    prisma.auditLog.count({
      where: {
        action:    'LOGIN_FAILED',
        createdAt: { gte: todayStart, lt: todayEnd }
      }
    }),
    prisma.file.count({
      where: { status: 'CONFIRMED', deletedAt: null }
    }),
    prisma.file.aggregate({
      where: { status: 'CONFIRMED', deletedAt: null },
      _sum:  { sizeBytes: true }
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: todayStart, lt: todayEnd }
      }
    })
  ])

  const totalStorageBytes = storageAggregate._sum.sizeBytes ?? 0

  const stats = {
    activeSessions,
    failedLoginsToday,
    totalFiles,
    totalStorageBytes,
    totalStorageMB: Math.round(totalStorageBytes / (1024 * 1024) * 100) / 100,
    auditLogsToday,
    cachedAt: new Date().toISOString()
  }

  await setCache(cacheKey, stats)
  return stats
}


exports.invalidateClinicStats = async (client = prisma) => {
  await redisClient.del('stats:clinic')
}

exports.invalidateMyStats = async (userId) => {
  await redisClient.del(`stats:me:${userId}`)
}

exports.invalidateSystemStats = async () => {
  await redisClient.del('stats:system')
}