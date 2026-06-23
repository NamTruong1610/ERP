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
} = require('../middleware/rateLimitMiddleware')

router.post("/login", loginLimiter, loginController)
router.post("/login/mfa/verify", mfaVerifyLimiter, verify2faLoginController)
router.post("/forgot-password", forgotPasswordLimiter, forgotPasswordController)
router.post("/reset-password", resetPasswordLimiter, resetPasswordController)
router.post("/logout", requireAuth, logoutController)
router.post("/logout/all", requireAuth, logoutAllController)
router.get('/me', requireAuth, getMeController)

module.exports = router;