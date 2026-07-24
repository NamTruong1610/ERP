import axiosInstance from './axiosInstance'

export const getMyStats = async () => {
  const { data } = await axiosInstance.get('/stats/me')
  return data  // { appointmentsToday, appointmentsThisWeek, uniquePatients, recentActivity, cachedAt }
}

export const getClinicStats = async () => {
  const { data } = await axiosInstance.get('/stats/clinic')
  return data  // { totalPatients, appointmentsToday, appointmentsThisWeek, totalActiveUsers, pendingActivations }
}

export const getSystemStats = async () => {
  const { data } = await axiosInstance.get('/stats/system')
  return data
}