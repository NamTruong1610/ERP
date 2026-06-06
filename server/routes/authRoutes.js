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

router.post("/login", loginController)
router.post("/login/mfa/verify", verify2faLoginController)
router.post("/forgot-password", forgotPasswordController)
router.post("/reset-password", resetPasswordController)
router.post("/logout", requireAuth, logoutController)
router.post("/logout/all", requireAuth, logoutAllController)
router.get('/me', requireAuth, getMeController)

module.exports = router;