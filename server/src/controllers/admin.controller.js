import * as adminService from '../services/admin.service.js';
export const createUserController = async (req, res, next) => {
  const { email } = req.body
  const data = await adminService.createUserService(email, {
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

export const deleteUserController = async (req, res, next) => {
  const { id } = req.params
  await adminService.deleteUserService(id, {
    id: req.user.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  })

  return res.status(200).json({
    message: 'User deleted successfully'
  })
}

export const hardDeleteUserController = async (req, res, next) => {
  const { id } = req.params
  await adminService.hardDeleteUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({
    message: 'User deleted successfully'
  })
}

export const getAllUsersController = async (req, res, next) => {
  const { search, take, skip } = req.query;
  const result = await adminService.getAllUsersService({ search, take, skip });
  return res.status(200).json(result);
};

export const getUserController = async (req, res, next) => {
  const { id } = req.params
  const data = await adminService.getUserService(id)
  return res.status(200).json(data)
}

export const suspendUserController = async (req, res, next) => {
  const { id } = req.params
  await adminService.suspendUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "User suspended successfully" })
}

// For users stuck in PENDING_ACTIVATION whose 48hr token expired (the user has already submitted their password and set up mfa, but hasn't verify otp for mfa)
export const reset2faController = async (req, res, next) => {
  const { id } = req.params
  await adminService.reset2faService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "2FA reset successfully" })
}

export const resendActivationEmailController = async (req, res, next) => {
  const { id } = req.params
  await adminService.resendActivationEmailService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "Activation email resent successfully" })
}

export const assignRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  const data = await adminService.assignRoleService(id, role, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ roles: data.roles })
}

export const removeRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  const data = await adminService.removeRoleService(id, role, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ roles: data.roles })
}

export const forceLogoutUserController = async (req, res, next) => {
  const { id } = req.params
  await adminService.forceLogoutUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "User forcefully logged out successfully" })
}

export const updateUserController = async (req, res, next) => {
  const { id } = req.params
  const data = await adminService.updateUserService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json(data)
}

export const reactivateUserController = async (req, res, next) => {
  const { id } = req.params
  await adminService.reactivateUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: "User reactivated successfully" })
}


