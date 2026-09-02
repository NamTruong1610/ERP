import * as authService from '../services/auth.service.js';
import * as constants from '../config/constants.js';
export const getMeController = async (req, res, next) => {
  const data = await authService.getMeService(req.user.id)
  return res.status(200).json(data)
}

export const loginController = async (req, res, next) => {
  const { email, password, rememberMe } = req.body
  const sessionId = req.cookies.SESSIONID
  const result = await authService.loginService(
    { email, password, rememberMe, sessionId },
    {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  )
  if (result.mfaRequired) {
    return res.status(200).json({ mfaLoginTokenId: result.mfaLoginTokenId });
  }

  res.cookie('SESSIONID', result.sessionId, { ...constants.COOKIE_OPTIONS, maxAge: constants.SESSION_TTL_MS });
  if (result.rememberTokenId) {
    res.cookie('REMEMBER', result.rememberTokenId, { ...constants.COOKIE_OPTIONS, maxAge: constants.REMEMBER_TTL_MS });
  }

  return res.status(200).json({ message: 'Logged in successfully' });
}

export const verify2faLoginController = async (req, res, next) => {
  const { otp, mfaLoginTokenId } = req.body
  const result = await authService.verify2faLoginService(
    { otp, mfaLoginTokenId },
    {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  )

  res.cookie('SESSIONID', result.sessionId, { ...constants.COOKIE_OPTIONS, maxAge: constants.SESSION_TTL_MS });
  if (result.rememberTokenId) {
    res.cookie('REMEMBER', result.rememberTokenId, { ...constants.COOKIE_OPTIONS, maxAge: constants.REMEMBER_TTL_MS });
  }
  return res.status(200).json({
    message: "Login successful"
  })
}

export const logoutController = async (req, res, next) => {
  const sessionId = req.cookies.SESSIONID;
  const rememberTokenId = req.cookies.REMEMBER;
  await authService.logoutService(
    { sessionId, rememberTokenId },
    {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  )

  // Clear cookies in the browser
  res.clearCookie('SESSIONID', { ...constants.COOKIE_OPTIONS })
  res.clearCookie('REMEMBER', { ...constants.COOKIE_OPTIONS })

  return res.status(200).json({ message: "Logged out successfully" });
};

export const logoutAllController = async (req, res, next) => {
  await authService.logoutAllService({
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  // Clear cookies for the current device (browser)
  res.clearCookie('SESSIONID', { ...constants.COOKIE_OPTIONS })
  res.clearCookie('REMEMBER', { ...constants.COOKIE_OPTIONS })


  return res.status(200).json({ message: "All sessions logged out successfully" });
};

export const forgotPasswordController = async (req, res, next) => {
  const { email } = req.body
  await authService.forgotPasswordService(email, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({ message: 'Recovery email has been sent' });
}

export const resetPasswordController = async (req, res, next) => {
  const { password, confirmPassword, recoveryToken } = req.body
  await authService.resetPasswordService(
    { password, confirmPassword, recoveryToken },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  )

  return res.status(200).json({
    message: "Password reset successfully"
  })
}

// Enable 2FA:
// - Verify password (confirm intent)
// - Go through 2FA setup (scan QR, verify OTP)
// - Current session continues uninterrupted

// Disable 2FA:
// - Verify password (confirm intent)
// - Verify current OTP (confirm they still have access to authenticator)
// - Invalidate all sessions and force re-login