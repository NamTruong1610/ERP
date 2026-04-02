import axiosInstance from './axiosInstance'
 
export const getProfile = async () => {
  const { data } = await axiosInstance.get('/user/profile')
  return data // { id, email, name, phones, addresses, roles }
}
 
export const updateName = async ({ name }) => {
  const { data } = await axiosInstance.post('/user/name', { name })
  return data
}
 
// Phones
export const addPhone = async ({ phone }) => {
  const { data } = await axiosInstance.post('/user/phones', { phone })
  return data // { phones }
}
 
export const removePhone = async ({ phone }) => {
  const { data } = await axiosInstance.delete(`/user/phones/${encodeURIComponent(phone)}`)
  return data // { phones }
}
 
// Addresses
export const addAddress = async ({ address }) => {
  const { data } = await axiosInstance.post('/user/addresses', { address })
  return data // { addresses }
}
 
export const updateAddress = async ({ addressId, address }) => {
  const { data } = await axiosInstance.patch(`/user/addresses/${addressId}`, { address })
  return data // { addresses }
}
 
export const removeAddress = async ({ addressId }) => {
  const { data } = await axiosInstance.delete(`/user/addresses/${addressId}`)
  return data // { addresses }
}
 
// Password
export const changePassword = async ({ currentPassword, newPassword, confirmNewPassword }) => {
  const { data } = await axiosInstance.post('/user/password', {
    currentPassword,
    newPassword,
    confirmNewPassword
  })
  return data
}
 
// Email
export const changeEmail = async ({ email, password }) => {
  const { data } = await axiosInstance.post('/user/email', { email, password })
  return data
}
 
export const verifyEmailChange = async ({ tokenId }) => {
  const { data } = await axiosInstance.post('/user/email/verify', { tokenId })
  return data
}
 
// 2FA
export const disable2fa = async ({ password, otp }) => {
  const { data } = await axiosInstance.post('/user/2fa/disable', { password, otp })
  return data
}
 
export const enable2fa = async ({ password, otp }) => {
  const { data } = await axiosInstance.post('/user/2fa/enable', { password, otp })
  return data
}