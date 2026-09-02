import * as userService from '../services/user.service.js';
import * as constants from '../config/constants.js';
export const getProfileController = async (req, res, next) => {
  const { id } = req.user
  const data = await userService.getProfileService(id)

  return res.status(200).json(
    data
  )
}

export const updateNameController = async (req, res, next) => {
  const { id } = req.user
  const { name } = req.body
  const { updatedName } = await userService.updateNameService(id, name)
  return res.status(200).json({
    name: updatedName
  })
}

export const updatePhonesController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.body
  const { phones } = await userService.updatePhonesService(id, phone)
  return res.status(200).json({ phones })
}

export const removePhoneController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.params
  const { phones } = await userService.removePhoneService(id, phone)
  return res.status(200).json({ phones })
}

export const addAddressController = async (req, res, next) => {
  const { id } = req.user
  const { address } = req.body
  const { addresses } = await userService.addAddressService(id, address)

  return res.status(200).json({ addresses })
}

export const updateAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  const { address } = req.body
  const { addresses } = await userService.updateAddressService({ id, addressId, address })
  return res.status(200).json({ addresses })
}

export const removeAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  const { addresses } = await userService.removeAddressService(id, addressId)
  return res.status(200).json({ addresses })
}

export const changePasswordController = async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body
  await userService.changePasswordService(
    { currentPassword, newPassword, confirmNewPassword },
    { id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] }
  )

  res.clearCookie("SESSIONID", { ...constants.COOKIE_OPTIONS })
  res.clearCookie("REMEMBER", { ...constants.COOKIE_OPTIONS })

  return res.status(200).json({ message: "Password changed successfully" })
}

export const changeEmailController = async (req, res, next) => {
  const { id } = req.user
  const { email, password } = req.body
  await userService.changeEmailService(
    { email, password },
    {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  )
  return res.status(200).json({ message: "Verification email sent" })
}

export const verifyEmailChangeController = async (req, res, next) => {
  const { tokenId } = req.body
  await userService.verifyEmailChangeService(tokenId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "Email changed successfully" })
}

export const disable2faController = async (req, res, next) => {
  const { password, otp } = req.body
  await userService.disable2faService({ password, otp }, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  res.clearCookie("SESSIONID", { ...constants.COOKIE_OPTIONS })
  res.clearCookie("REMEMBER", { ...constants.COOKIE_OPTIONS })

  return res.status(200).json({ message: "2FA disabled successfully" })
}

export const enable2faController = async (req, res, next) => {
  const { password, otp } = req.body
  await userService.enable2faService({ password, otp }, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "2FA enabled successfully" })
}

export const getDentistsController = async (req, res, next) => {
  const { dentists } = await userService.getDentistsService()
  return res.status(200).json({ dentists })
}