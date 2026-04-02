import axiosInstance from './axiosInstance'
 
export const setPassword = async ({ activationToken, password, confirmPassword }) => {
  const { data } = await axiosInstance.post('/activate/password', {
    activationToken,
    password,
    confirmPassword
  })
  return data // { activationToken, mfaToken }
}
 
export const get2faSecret = async ({ activationToken, mfaToken }) => {
  const { data } = await axiosInstance.post('/activate/mfa/secret', {
    activationToken,
    mfaToken
  })
  return data // { qrUri, activationToken }
}
 
export const verify2faSetup = async ({ otp, activationToken, mfaToken }) => {
  const { data } = await axiosInstance.post('/activate/mfa/verify', {
    otp,
    activationToken,
    mfaToken
  })
  return data // { message }
}