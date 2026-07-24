const {
  getMeService,
  loginService,
  verify2faLoginService,
  logoutService,
  logoutAllService,
  forgotPasswordService,
  resetPasswordService
} = require('../services/authService')

const {
  COOKIE_OPTIONS, SESSION_TTL_MS, REMEMBER_TTL_MS
} = require('../config/constants.js')

const { AppError } = require('../lib/AppError');

exports.getMeController = async (req, res, next) => {
  try {
    const data = await getMeService(req.user.id)
    return res.status(200).json(data)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.loginController = async (req, res, next) => {
  const { email, password, rememberMe } = req.body
  const sessionId = req.cookies.SESSIONID
  try {
    const result = await loginService(
      { email, password, rememberMe, sessionId },
      {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )
    if (result.mfaRequired) {
      return res.status(200).json({ mfaLoginTokenId: result.mfaLoginTokenId });
    }

    res.cookie('SESSIONID', result.sessionId, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS });
    if (result.rememberTokenId) {
      res.cookie('REMEMBER', result.rememberTokenId, { ...COOKIE_OPTIONS, maxAge: REMEMBER_TTL_MS });
    }

    return res.status(200).json({ message: 'Logged in successfully' });

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.verify2faLoginController = async (req, res, next) => {
  const { otp, mfaLoginTokenId } = req.body
  try {
    const result = await verify2faLoginService(
      { otp, mfaLoginTokenId },
      {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )

    res.cookie('SESSIONID', result.sessionId, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS });
    if (result.rememberTokenId) {
      res.cookie('REMEMBER', result.rememberTokenId, { ...COOKIE_OPTIONS, maxAge: REMEMBER_TTL_MS });
    }
    return res.status(200).json({
      message: "Login successful"
    })

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.logoutController = async (req, res, next) => {
  const sessionId = req.cookies.SESSIONID;
  const rememberTokenId = req.cookies.REMEMBER;
  try {
    await logoutService(
      { sessionId, rememberTokenId },
      {
        id: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )

    // Clear cookies in the browser
    res.clearCookie('SESSIONID', { ...COOKIE_OPTIONS })
    res.clearCookie('REMEMBER', { ...COOKIE_OPTIONS })

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.logoutAllController = async (req, res, next) => {
  try {
    await logoutAllService({
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    // Clear cookies for the current device (browser)
    res.clearCookie('SESSIONID', { ...COOKIE_OPTIONS })
    res.clearCookie('REMEMBER', { ...COOKIE_OPTIONS })


    return res.status(200).json({ message: "All sessions logged out successfully" });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.forgotPasswordController = async (req, res, next) => {
  const { email } = req.body
  try {
    await forgotPasswordService(email, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ message: 'Recovery email has been sent' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}

exports.resetPasswordController = async (req, res, next) => {
  const { password, confirmPassword, recoveryToken } = req.body
  try {
    await resetPasswordService(
      { password, confirmPassword, recoveryToken },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    )

    return res.status(200).json({
      message: "Password reset successfully"
    })

  } catch (error) {
    next(error)
  }
}

// Enable 2FA:
// - Verify password (confirm intent)
// - Go through 2FA setup (scan QR, verify OTP)
// - Current session continues uninterrupted

// Disable 2FA:
// - Verify password (confirm intent)
// - Verify current OTP (confirm they still have access to authenticator)
// - Invalidate all sessions and force re-login