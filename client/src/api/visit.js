import axiosInstance from './axiosInstance'

export const getVisit = async (id) => {
  const { data } = await axiosInstance.get(`/visits/${id}`)
  return data // { visit }
}

export const createVisitFromAppointment = async ({ appointmentId, visitDate, notes, providers }) => {
  const { data } = await axiosInstance.post('/visits/from-appointment', { appointmentId, visitDate, notes, providers })
  return data // { visit }
}

export const createWalkInVisit = async ({ patientId, visitDate, notes, providers }) => {
  const { data } = await axiosInstance.post('/visits/walk-in', { patientId, visitDate, notes, providers })
  return data // { visit }
}

export const updateVisit = async (id, visitData) => {
  const { data } = await axiosInstance.patch(`/visits/${id}`, visitData)
  return data // { visit }
}

export const addVisitProvider = async (visitId, { performerId, role }) => {
  const { data } = await axiosInstance.post(`/visits/${visitId}/providers`, { performerId, role })
  return data // { provider }
}

export const editVisitProviderRole = async (visitId, providerId, role) => {
  const { data } = await axiosInstance.patch(`/visits/${visitId}/providers/${providerId}`, { role })
  return data // { provider }
}

export const removeVisitProvider = async (visitId, providerId) => {
  await axiosInstance.delete(`/visits/${visitId}/providers/${providerId}`)
}