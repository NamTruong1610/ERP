import axiosInstance from './axiosInstance'
 
export const login = async ({ email, password, rememberMe }) => {
  const { data } = await axiosInstance.post('/auth/login', { email, password, rememberMe })
  return data // { message } or { mfaLoginTokenId }
}
 
export const verifyMfaLogin = async ({ otp, mfaLoginTokenId }) => {
  const { data } = await axiosInstance.post('/auth/login/mfa/verify', { otp, mfaLoginTokenId })
  return data // { message }
}
 
export const forgotPassword = async ({ email }) => {
  const { data } = await axiosInstance.post('/auth/forgot-password', { email })
  return data // { message }
}
 
export const resetPassword = async ({ password, confirmPassword, recoveryToken }) => {
  const { data } = await axiosInstance.post('/auth/reset-password', { password, confirmPassword, recoveryToken })
  return data // { message }
}
 
export const logout = async () => {
  const { data } = await axiosInstance.post('/auth/logout')
  return data
}
 
export const logoutAll = async () => {
  const { data } = await axiosInstance.post('/auth/logout/all')
  return data
}