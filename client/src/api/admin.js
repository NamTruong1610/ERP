import axiosInstance from './axiosInstance'
 
export const getAllUsers = async () => {
  const { data } = await axiosInstance.get('/admin/users')
  return data // { users }
}
 
export const getUser = async (id) => {
  const { data } = await axiosInstance.get(`/admin/users/${id}`)
  return data
}
 
export const createUser = async ({ email }) => {
  const { data } = await axiosInstance.post('/admin/users', { email })
  return data 
}
 
export const updateUser = async (id, updates) => {
  const { data } = await axiosInstance.patch(`/admin/users/${id}`, updates)
  return data
}
 
export const deleteUser = async (id) => {
  const { data } = await axiosInstance.delete(`/admin/users/${id}`)
  return data
}
 
export const suspendUser = async (id) => {
  const { data } = await axiosInstance.post(`/admin/users/${id}/suspend`)
  return data
}
 
export const reactivateUser = async (id) => {
  const { data } = await axiosInstance.post(`/admin/users/${id}/reactivate`)
  return data
}
 
export const forceLogoutUser = async (id) => {
  const { data } = await axiosInstance.post(`/admin/users/${id}/force-logout`)
  return data
}
 
export const resendActivationEmail = async (id) => {
  const { data } = await axiosInstance.post(`/admin/users/${id}/resend-activation`)
  return data
}
 
export const reset2fa = async (id) => {
  const { data } = await axiosInstance.post(`/admin/users/${id}/reset-2fa`)
  return data
}
 
export const assignRole = async (id, role) => {
  const { data } = await axiosInstance.post(`/admin/users/${id}/roles`, { role })
  return data
}
 
export const removeRole = async (id, role) => {
  const { data } = await axiosInstance.delete(`/admin/users/${id}/roles`, { data: { role } })
  return data
}