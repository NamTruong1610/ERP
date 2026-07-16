const {
  setPasswordService,
  get2faSecretService,
  verify2faSecretSetupService
} = require('../service/activationService')

const { AppError } = require('../utils/errorsUtil.js');

exports.setPasswordController = async (req, res, next) => {
  const { activationToken, password, confirmPassword } = req.body
  try {

    const { activationToken, mfaToken, passwordRequired } = await setPasswordService({
      activationToken,
      password,
      confirmPassword
    },
      {
        id: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      })

    return res.status(200).json({
      activationToken,
      mfaToken,
      passwordRequired
    })

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.get2faSecretController = async (req, res, next) => {
  const { activationToken, mfaToken } = req.body
  try {
    const { qrUri, activationToken } = await get2faSecretService(
      { activationToken, mfaToken },
      {
        id: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )

    return res.status(200).json({
      qrUri,
      activationToken
    })
  }
  catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.verify2faSecretSetupController = async (req, res, next) => {
  const { otp, activationToken, mfaToken } = req.body
  try {
    await verify2faSecretSetupService(
      { otp, activationToken, mfaToken }, 
      {
        id: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )

    return res.status(200).json({
      message: "User 2fa successfully activated"
    })

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

