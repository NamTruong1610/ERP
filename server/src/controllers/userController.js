const {
  getProfileService,
  updateNameService,
  updatePhonesService,
  removePhoneService,
  addAddressService,
  updateAddressService,
  removeAddressService,
  changePasswordService,
  changeEmailService,
  verifyEmailChangeService,
  disable2faService,
  enable2faService,
  getDentistsService
} = require('../services/userService')

exports.getProfileController = async (req, res, next) => {
  const { id } = req.user
  const data = await getProfileService(id)

  return res.status(200).json(
    data
  )
}

exports.updateNameController = async (req, res, next) => {
  const { id } = req.user
  const { name } = req.body
  const { updatedName } = await updateNameService(id, name)
  return res.status(200).json({
    name: updatedName
  })
}

exports.updatePhonesController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.body
  const { phones } = await updatePhonesService(id, phone)
  return res.status(200).json({ phones })
}

exports.removePhoneController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.params
  const { phones } = await removePhoneService(id, phone)
  return res.status(200).json({ phones })
}

exports.addAddressController = async (req, res, next) => {
  const { id } = req.user
  const { address } = req.body
  const { addresses } = await addAddressService(id, address)

  return res.status(200).json({ addresses })
}

exports.updateAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  const { address } = req.body
  const { addresses } = await updateAddressService({ id, addressId, address })
  return res.status(200).json({ addresses })
}

exports.removeAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  const { addresses } = await removeAddressService(id, addressId)
  return res.status(200).json({ addresses })
}

exports.changePasswordController = async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body
  await changePasswordService(
    { currentPassword, newPassword, confirmNewPassword },
    { id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] }
  )

  res.clearCookie("SESSIONID", { ...COOKIE_OPTIONS })
  res.clearCookie("REMEMBER", { ...COOKIE_OPTIONS })

  return res.status(200).json({ message: "Password changed successfully" })
}

exports.changeEmailController = async (req, res, next) => {
  const { id } = req.user
  const { email, password } = req.body
  await changeEmailService(
    { email, password },
    {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  )
  return res.status(200).json({ message: "Verification email sent" })
}

exports.verifyEmailChangeController = async (req, res, next) => {
  const { tokenId } = req.body
  await verifyEmailChangeService(tokenId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "Email changed successfully" })
}

exports.disable2faController = async (req, res, next) => {
  const { password, otp } = req.body
  await disable2faService({ password, otp }, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  res.clearCookie("SESSIONID", { ...COOKIE_OPTIONS })
  res.clearCookie("REMEMBER", { ...COOKIE_OPTIONS })

  return res.status(200).json({ message: "2FA disabled successfully" })
}

exports.enable2faController = async (req, res, next) => {
  const { password, otp } = req.body
  await enable2faService({ password, otp }, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "2FA enabled successfully" })
}

exports.getDentistsController = async (req, res, next) => {
  const { dentists } = await getDentistsService()
  return res.status(200).json({ dentists })
}