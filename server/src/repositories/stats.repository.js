import * as prismaConfig from '../config/prisma.config.js';
import * as redisConfig from '../config/redis.config.js';
import * as constants from '../config/constants.js';
const TZ = process.env.CLINIC_TIMEZONE || 'Australia/Sydney'

export const getCached = async (key) => {
  const raw = await redisConfig.redisClient.get(key)
  return raw ? JSON.parse(raw) : null
}

export const setCache = async (key, value) => {
  await redisConfig.redisClient.set(key, JSON.stringify(value), { EX: constants.CACHE_TTL_SECONDS })
}

export const getDateBounds = async () => {
  const [today, week] = await Promise.all([
    prismaConfig.prisma.$queryRaw`
      SELECT
        date_trunc('day', NOW() AT TIME ZONE ${TZ})
          AT TIME ZONE ${TZ} AS start,
        (date_trunc('day', NOW() AT TIME ZONE ${TZ}) + INTERVAL '1 day')
          AT TIME ZONE ${TZ} AS "end"
    `,
    prismaConfig.prisma.$queryRaw`
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

export const invalidateClinicStats = async (client = prismaConfig.prisma) => {
  await redisConfig.redisClient.del('stats:clinic')
}

export const invalidateMyStats = async (userId) => {
  await redisConfig.redisClient.del(`stats:me:${userId}`)
}

export const invalidateSystemStats = async () => {
  await redisConfig.redisClient.del('stats:system')
}

// data access
export const countDentistAppointmentsInRange = (dentistId, start, end) =>
  prismaConfig.prisma.appointment.count({
    where: { dentistId, deletedAt: null, date: { gte: start, lt: end } },
  });

export const countUniquePatientsForDentist = (dentistId) =>
  prismaConfig.prisma.appointment.findMany({
    where: { dentistId, deletedAt: null },
    select: { patientId: true },
    distinct: ['patientId'],
  }).then(rows => rows.length);

export const findRecentAuditActivity = (actorId, take = 5) =>
  prismaConfig.prisma.auditLog.findMany({
    where: { actorId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { action: true, targetType: true, createdAt: true, metadata: true },
  });

export const countActivePatients = () =>
  prismaConfig.prisma.patient.count({ where: { deletedAt: null } });

export const countUsersByStatus = (status) =>
  prismaConfig.prisma.user.count({ where: { status, deletedAt: null } });

export const countAppointmentsInRange = (start, end) =>
  prismaConfig.prisma.appointment.count({
    where: { deletedAt: null, date: { gte: start, lt: end } },
  });

export const countVisitsInRange = (start, end) =>
  prismaConfig.prisma.visit.count({
    where: { deletedAt: null, visitDate: { gte: start, lt: end } },
  });

export const groupAppointmentsByStatus = () =>
  prismaConfig.prisma.appointment.groupBy({
    by: ['status'],
    where: { deletedAt: null },
    _count: { status: true },
  });

export const findRecentPatients = (take = 5) =>
  prismaConfig.prisma.patient.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, firstName: true, lastName: true, createdAt: true },
  });

export const countActiveSessions = async () => {
  let cursor = '0';
  let count = 0;
  do {
    const { cursor: nextCursor, keys } = await redisConfig.redisClient.scan(cursor, {
      MATCH: 'session:*',
      COUNT: 100,
    });
    count += keys.length;
    cursor = nextCursor;
  } while (cursor !== '0');
  return count;
};

export const countAuditLogsByAction = (action, start, end) =>
  prismaConfig.prisma.auditLog.count({
    where: { action, createdAt: { gte: start, lt: end } },
  });

export const countAuditLogsInRange = (start, end) =>
  prismaConfig.prisma.auditLog.count({ where: { createdAt: { gte: start, lt: end } } });

export const countFilesByStatus = (status) =>
  prismaConfig.prisma.file.count({ where: { status, deletedAt: null } });

export const sumFileSizeByStatus = (status) =>
  prismaConfig.prisma.file.aggregate({
    where: { status, deletedAt: null },
    _sum: { sizeBytes: true },
  });