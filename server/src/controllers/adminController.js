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
} = require('../service/adminService')

const { AppError } = require('../utils/errorsUtil.js');

exports.createUserController = async (req, res, next) => {
  const { email } = req.body
  try {
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

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.deleteUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    await deleteUserService(id, {
      id: req.user.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    })

    return res.status(200).json({
      message: 'User deleted successfully'
    })

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.hardDeleteUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    await hardDeleteUserService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }

}

exports.getAllUsersController = async (req, res, next) => {
  const { search, take, skip } = req.query;
  try {
    const result = await getAllUsersService({ search, take, skip });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const data = await getUserService(id)

    return res.status(200).json(data)

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.suspendUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    await suspendUserService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: "User suspended successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

// For users stuck in PENDING_ACTIVATION whose 48hr token expired (the user has already submitted their password and set up mfa, but hasn't verify otp for mfa)
exports.reset2faController = async (req, res, next) => {
  const { id } = req.params
  try {
    await reset2faService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: "2FA reset successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.resendActivationEmailController = async (req, res, next) => {
  const { id } = req.params
  try {
    await resendActivationEmailService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: "Activation email resent successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.assignRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  try {
    const data = await assignRoleService(id, role, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ roles: data.roles })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.removeRoleController = async (req, res, next) => {
  const { id } = req.params
  const { role } = req.body
  try {
    const data = await removeRoleService(id, role, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ roles: data.roles })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.forceLogoutUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    await forceLogoutUserService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: "User forcefully logged out successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.updateUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    const data = await updateUserService(id, req.body, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json(data)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.reactivateUserController = async (req, res, next) => {
  const { id } = req.params
  try {
    await reactivateUserService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: "User reactivated successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}


