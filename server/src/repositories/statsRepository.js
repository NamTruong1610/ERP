const { prisma } = require('../config/PrismaConfig')
const { redisClient } = require('../config/RedisConfig')
const { CACHE_TTL_SECONDS } = require('../config/constants')

const TZ = process.env.CLINIC_TIMEZONE || 'Australia/Sydney'

exports.getCached = async (key) => {
  const raw = await redisClient.get(key)
  return raw ? JSON.parse(raw) : null
}

exports.setCache = async (key, value) => {
  await redisClient.set(key, JSON.stringify(value), { EX: CACHE_TTL_SECONDS })
}

exports.getDateBounds = async () => {
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

exports.invalidateClinicStats = async (client = prisma) => {
  await redisClient.del('stats:clinic')
}

exports.invalidateMyStats = async (userId) => {
  await redisClient.del(`stats:me:${userId}`)
}

exports.invalidateSystemStats = async () => {
  await redisClient.del('stats:system')
}

// data access
exports.countDentistAppointmentsInRange = (dentistId, start, end) =>
  prisma.appointment.count({
    where: { dentistId, deletedAt: null, date: { gte: start, lt: end } },
  });

exports.countUniquePatientsForDentist = (dentistId) =>
  prisma.appointment.findMany({
    where: { dentistId, deletedAt: null },
    select: { patientId: true },
    distinct: ['patientId'],
  }).then(rows => rows.length);

exports.findRecentAuditActivity = (actorId, take = 5) =>
  prisma.auditLog.findMany({
    where: { actorId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { action: true, targetType: true, createdAt: true, metadata: true },
  });

exports.countActivePatients = () =>
  prisma.patient.count({ where: { deletedAt: null } });

exports.countUsersByStatus = (status) =>
  prisma.user.count({ where: { status, deletedAt: null } });

exports.countAppointmentsInRange = (start, end) =>
  prisma.appointment.count({
    where: { deletedAt: null, date: { gte: start, lt: end } },
  });

exports.countVisitsInRange = (start, end) =>
  prisma.visit.count({
    where: { deletedAt: null, visitDate: { gte: start, lt: end } },
  });

exports.groupAppointmentsByStatus = () =>
  prisma.appointment.groupBy({
    by: ['status'],
    where: { deletedAt: null },
    _count: { status: true },
  });

exports.findRecentPatients = (take = 5) =>
  prisma.patient.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, firstName: true, lastName: true, createdAt: true },
  });

exports.countActiveSessions = async () => {
  let cursor = '0';
  let count = 0;
  do {
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
      MATCH: 'session:*',
      COUNT: 100,
    });
    count += keys.length;
    cursor = nextCursor;
  } while (cursor !== '0');
  return count;
};

exports.countAuditLogsByAction = (action, start, end) =>
  prisma.auditLog.count({
    where: { action, createdAt: { gte: start, lt: end } },
  });

exports.countAuditLogsInRange = (start, end) =>
  prisma.auditLog.count({ where: { createdAt: { gte: start, lt: end } } });

exports.countFilesByStatus = (status) =>
  prisma.file.count({ where: { status, deletedAt: null } });

exports.sumFileSizeByStatus = (status) =>
  prisma.file.aggregate({
    where: { status, deletedAt: null },
    _sum: { sizeBytes: true },
  });