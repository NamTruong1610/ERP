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
} = require('../service/userService')

const { AppError } = require('../utils/errorsUtil.js');

exports.getProfileController = async (req, res, next) => {
  const { id } = req.user
  try {
    const data = await getProfileService(id)

    return res.status(200).json(
      data
    )

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.updateNameController = async (req, res, next) => {
  const { id } = req.user
  const { name } = req.body
  try {
    const { updatedName } = await updateNameService(id, name)
    return res.status(200).json({
      name: updatedName
    })

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.updatePhonesController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.body
  try {
    const { phones } = await updatePhonesService(id, phone)
    return res.status(200).json({ phones })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.removePhoneController = async (req, res, next) => {
  const { id } = req.user
  const { phone } = req.params
  try {
    const { phones } = await removePhoneService(id, phone)
    return res.status(200).json({ phones })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.addAddressController = async (req, res, next) => {
  const { id } = req.user
  const { address } = req.body
  try {
    const { addresses } = await addAddressService(id, address)

    return res.status(200).json({ addresses })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.updateAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  const { address } = req.body
  try {
    const { addresses } = await updateAddressService({ id, addressId, address })
    return res.status(200).json({ addresses })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.removeAddressController = async (req, res, next) => {
  const { id } = req.user
  const { addressId } = req.params
  try {
    const { addresses } = await removeAddressService(id, addressId)
    return res.status(200).json({ addresses })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.changePasswordController = async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body
  try {
    await changePasswordService(
      { currentPassword, newPassword, confirmNewPassword },
      { id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] }
    )

    res.clearCookie("SESSIONID", { ...COOKIE_OPTIONS })
    res.clearCookie("REMEMBER", { ...COOKIE_OPTIONS })

    return res.status(200).json({ message: "Password changed successfully" })

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.changeEmailController = async (req, res, next) => {
  const { id } = req.user
  const { email, password } = req.body
  try {
    await changeEmailService(
      { email, password },
      {
        id: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )
    return res.status(200).json({ message: "Verification email sent" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.verifyEmailChangeController = async (req, res, next) => {
  const { tokenId } = req.body
  try {
    await verifyEmailChangeService(tokenId, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: "Email changed successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.disable2faController = async (req, res, next) => {
  const { password, otp } = req.body
  try {
    await disable2faService({ password, otp }, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.clearCookie("SESSIONID", { ...COOKIE_OPTIONS })
    res.clearCookie("REMEMBER", { ...COOKIE_OPTIONS })

    return res.status(200).json({ message: "2FA disabled successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.enable2faController = async (req, res, next) => {
  const { password, otp } = req.body
  try {
    await enable2faService({ password, otp }, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: "2FA enabled successfully" })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getDentistsController = async (req, res, next) => {
  try {
    const dentists = await getDentistsService()
    return res.status(200).json({ dentists })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}



