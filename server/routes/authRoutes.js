const express = require("express");
const router = express.Router();
const {
  getMeController,
  loginController,
  verify2faLoginController,
  logoutController,
  logoutAllController,
  forgotPasswordController,
  resetPasswordController
} = require("../controllers/authControllers")

const { findUserById } = require('../services/userService')

const {
  requireAuth
} = require("../middlewares/authMiddleware")

const {
  loginLimiter,
  mfaVerifyLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter
} = require('../middlewares/rateLimitMiddleware')

const {
  validateLogin,
  validateMfaLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../middlewares/validators/authValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get('/me', requireAuth, getMeController)
router.post('/login', loginLimiter, validateLogin, handleValidationErrors, loginController)
router.post('/login/mfa', mfaVerifyLimiter, validateMfaLogin, handleValidationErrors, verify2faLoginController)
router.post('/logout', requireAuth, logoutController)
router.post('/logout/all', requireAuth, logoutAllController)
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, handleValidationErrors, forgotPasswordController)
router.post('/reset-password', resetPasswordLimiter, validateResetPassword, handleValidationErrors, resetPasswordController)

module.exports = router;