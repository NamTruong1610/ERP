import * as statsRepository from '../repositories/stats.repository.js';
// service
export const getMyStatsService = async (userId) => {
  const cacheKey = `stats:me:${userId}`;
  const cached = await statsRepository.getCached(cacheKey);
  if (cached) return cached;

  const { todayStart, todayEnd, weekStart, weekEnd } = await statsRepository.getDateBounds();

  const [appointmentsToday, appointmentsThisWeek, uniquePatients, recentActivity] = await Promise.all([
    statsRepository.countDentistAppointmentsInRange(userId, todayStart, todayEnd),
    statsRepository.countDentistAppointmentsInRange(userId, weekStart, weekEnd),
    statsRepository.countUniquePatientsForDentist(userId),
    statsRepository.findRecentAuditActivity(userId),
  ]);

  const stats = {
    appointmentsToday,
    appointmentsThisWeek,
    uniquePatients,
    recentActivity,
    cachedAt: new Date().toISOString(),
  };

  await statsRepository.setCache(cacheKey, stats);
  return stats;
};

export const getClinicStatsService = async () => {
  const cacheKey = 'stats:clinic';
  const cached = await statsRepository.getCached(cacheKey);
  if (cached) return cached;

  const { todayStart, todayEnd, weekStart, weekEnd } = await statsRepository.getDateBounds();

  const [
    totalPatients,
    totalActiveUsers,
    pendingActivations,
    appointmentsToday,
    appointmentsThisWeek,
    visitsToday,              // ← added
    appointmentsByStatus,
    recentPatients,
  ] = await Promise.all([
    statsRepository.countActivePatients(),
    statsRepository.countUsersByStatus('ACTIVE'),
    statsRepository.countUsersByStatus('PENDING_ACTIVATION'),
    statsRepository.countAppointmentsInRange(todayStart, todayEnd),
    statsRepository.countAppointmentsInRange(weekStart, weekEnd),
    statsRepository.countVisitsInRange(todayStart, todayEnd),   // ← added
    statsRepository.groupAppointmentsByStatus(),
    statsRepository.findRecentPatients(),
  ]);

  const stats = {
    totalPatients,
    totalActiveUsers,
    pendingActivations,
    appointmentsToday,
    appointmentsThisWeek,
    visitsToday,             // ← added
    appointmentsByStatus: appointmentsByStatus.reduce((acc, row) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {}),
    recentPatients,
    cachedAt: new Date().toISOString(),
  };

  await statsRepository.setCache(cacheKey, stats);
  return stats;
};

export const getSystemStatsService = async () => {
  const cacheKey = 'stats:system';
  const cached = await statsRepository.getCached(cacheKey);
  if (cached) return cached;

  const { todayStart, todayEnd } = await statsRepository.getDateBounds();

  const [
    activeSessions,
    failedLoginsToday,
    totalFiles,
    storageAggregate,
    auditLogsToday,
  ] = await Promise.all([
    statsRepository.countActiveSessions(),
    statsRepository.countAuditLogsByAction('LOGIN_FAILED', todayStart, todayEnd),
    statsRepository.countFilesByStatus('CONFIRMED'),
    statsRepository.sumFileSizeByStatus('CONFIRMED'),
    statsRepository.countAuditLogsInRange(todayStart, todayEnd),
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

  await statsRepository.setCache(cacheKey, stats);
  return stats;
};

