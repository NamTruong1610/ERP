const {
  createUserService,
  deleteUserService,
  hardDeleteUserService,
  getAllUsersService,
  getUserService,
  suspendUserService,
  reset2faService,
  resendActivationEmailService,
  assignRoleService,
  removeRoleController,
  forceLogoutUserService,
  updateUserService
} = require('../services/adminService')

exports.createUserController = async (req, res, next) => {
  const { email } = req.body
  const data = await createUserService(email, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(201).json({
    id: data.id,
    email: data.email,
    status: data.status
  })
}

exports.deleteUserController = async (req, res, next) => {
  const { id } = req.params
  await deleteUserService(id, {
    id: req.user.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  })

  return res.status(200).json({
    message: 'User deleted successfully'
  })
}

exports.hardDeleteUserController = async (req, res, next) => {
  const { id } = req.params
  await hardDeleteUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({
    message: 'User deleted successfully'
  })
}

exports.getAllUsersController = async (req, res, next) => {
  const { search, take, skip } = req.query;
  const result = await getAllUsersService({ search, take, skip });
  return res.status(200).json(result);
};

exports.getUserController = async (req, res, next) => {
  const { id } = req.params
  const data = await getUserService(id)
  return res.status(200).json(data)
}

exports.suspendUserController = async (req, res, next) => {
  const { id } = req.params
  await suspendUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "User suspended successfully" })
}

// For users stuck in PENDING_ACTIVATION whose 48hr token expired (the user has already submitted their password and set up mfa, but hasn't verify otp for mfa)
exports.reset2faController = async (req, res, next) => {
  const { id } = req.params
  await reset2faService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "2FA reset successfully" })
}

exports.resendActivationEmailController = async (req, res, next) => {
  const { id } = req.params
  await resendActivationEmailService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "Activation email resent successfully" })
}

exports.assignRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  const data = await assignRoleService(id, role, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ roles: data.roles })
}

exports.removeRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  const data = await removeRoleService(id, role, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ roles: data.roles })
}

exports.forceLogoutUserController = async (req, res, next) => {
  const { id } = req.params
  await forceLogoutUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "User forcefully logged out successfully" })
}

exports.updateUserController = async (req, res, next) => {
  const { id } = req.params
  const data = await updateUserService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json(data)
}

exports.reactivateUserController = async (req, res, next) => {
  const { id } = req.params
  await reactivateUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "User reactivated successfully" })
}


