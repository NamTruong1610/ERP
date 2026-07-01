import axiosInstance from './axiosInstance'

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const getAuditLogs = async ({ cursor, take = 50 } = {}) => {
  const params = { take, ...(cursor ? { cursor } : {}) }
  const { data } = await axiosInstance.get('/system/audit', { params })
  return data  // { logs, nextCursor, hasMore }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const getAllSessions = async () => {
  const { data } = await axiosInstance.get('/system/sessions')
  return data  // { sessions }
}

export const revokeSession = async (sessionId) => {
  const { data } = await axiosInstance.delete(`/system/sessions/${sessionId}`)
  return data
}

export const revokeAllSessions = async () => {
  const { data } = await axiosInstance.delete('/system/sessions')
  return data
}

// ─── Deleted Users ────────────────────────────────────────────────────────────
export const getDeletedUsers = async () => {
  const { data } = await axiosInstance.get('/system/users/deleted')
  return data  // { users }
}

export const restoreUser = async (id) => {
  const { data } = await axiosInstance.post(`/system/users/${id}/restore`)
  return data
}

export const purgeUser = async (id) => {
  const { data } = await axiosInstance.delete(`/system/users/${id}/purge`)
  return data
}