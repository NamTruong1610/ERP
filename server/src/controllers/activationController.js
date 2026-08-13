const {
  setPasswordService,
  get2faSecretService,
  verify2faSecretSetupService
} = require('../services/activationService')

exports.setPasswordController = async (req, res, next) => {
  const { activationToken, password, confirmPassword } = req.body

  const result = await setPasswordService({
    activationToken,
    password,
    confirmPassword
  })

  return res.status(200).json({
    activationToken: result.activationToken,
    mfaToken: result.mfaToken,
    passwordRequired: result.passwordRequired
  })
}

exports.get2faSecretController = async (req, res, next) => {
  const { activationToken, mfaToken } = req.body
  const result = await get2faSecretService(
    { activationToken, mfaToken }
  )

  return res.status(200).json({
    qrUri: result.qrUri,
    activationToken: result.activationToken
  })
}

exports.verify2faSecretSetupController = async (req, res, next) => {
  const { otp, activationToken, mfaToken } = req.body
  const actor = { ip: req.ip, userAgent: req.get('User-Agent') }
  await verify2faSecretSetupService(
    { otp, activationToken, mfaToken },
    actor
  )

  return res.status(200).json({
    message: "User 2fa successfully activated"
  })
}

