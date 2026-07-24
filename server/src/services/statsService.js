const {
  getDateBounds,
  countDentistAppointmentsInRange,
  countUniquePatientsForDentist,
  findRecentAuditActivity,
  getClinicStats,
  getSystemStats,
  getCached,
  setCache,
  countActivePatients,
  countUsersByStatus,
  countAppointmentsInRange,
  groupAppointmentsByStatus,
  findRecentPatients,
  countActiveSessions,
  countAuditLogsByAction,
  countFilesByStatus,
  sumFileSizeByStatus,
  countAuditLogsInRange,
} = require('../repositories/statsRepository')

// service
exports.getMyStatsService = async (userId) => {
  const cacheKey = `stats:me:${userId}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const { todayStart, todayEnd, weekStart, weekEnd } = await getDateBounds();

  const [appointmentsToday, appointmentsThisWeek, uniquePatients, recentActivity] = await Promise.all([
    countDentistAppointmentsInRange(userId, todayStart, todayEnd),
    countDentistAppointmentsInRange(userId, weekStart, weekEnd),
    countUniquePatientsForDentist(userId),
    findRecentAuditActivity(userId),
  ]);

  const stats = {
    appointmentsToday,
    appointmentsThisWeek,
    uniquePatients,
    recentActivity,
    cachedAt: new Date().toISOString(),
  };

  await setCache(cacheKey, stats);
  return stats;
};

exports.getClinicStatsService = async () => {
  const cacheKey = 'stats:clinic';
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const { todayStart, todayEnd, weekStart, weekEnd } = await getDateBounds();

  const [
    totalPatients,
    totalActiveUsers,
    pendingActivations,
    appointmentsToday,
    appointmentsThisWeek,
    appointmentsByStatus,
    recentPatients,
  ] = await Promise.all([
    countActivePatients(),
    countUsersByStatus('ACTIVE'),
    countUsersByStatus('PENDING_ACTIVATION'),
    countAppointmentsInRange(todayStart, todayEnd),
    countAppointmentsInRange(weekStart, weekEnd),
    groupAppointmentsByStatus(),
    findRecentPatients(),
  ]);

  const stats = {
    totalPatients,
    totalActiveUsers,
    pendingActivations,
    appointmentsToday,
    appointmentsThisWeek,
    appointmentsByStatus: appointmentsByStatus.reduce((acc, row) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {}),
    recentPatients,
    cachedAt: new Date().toISOString(),
  };

  await setCache(cacheKey, stats);
  return stats;
};

exports.getSystemStatsService = async () => {
  const cacheKey = 'stats:system';
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const { todayStart, todayEnd } = await getDateBounds();

  const [
    activeSessions,
    failedLoginsToday,
    totalFiles,
    storageAggregate,
    auditLogsToday,
  ] = await Promise.all([
    countActiveSessions(),
    countAuditLogsByAction('LOGIN_FAILED', todayStart, todayEnd),
    countFilesByStatus('CONFIRMED'),
    sumFileSizeByStatus('CONFIRMED'),
    countAuditLogsInRange(todayStart, todayEnd),
  ]);

  const totalStorageBytes = storageAggregate._sum.sizeBytes ?? 0;

  const stats = {
    activeSessions,
    failedLoginsToday,
    totalFiles,
    totalStorageBytes,
    totalStorageMB: Math.round((totalStorageBytes / (1024 * 1024)) * 100) / 100,
    auditLogsToday,
    cachedAt: new Date().toISOString(),
  };

  await setCache(cacheKey, stats);
  return stats;
};

