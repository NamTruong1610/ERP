const express = require("express");
const router = express.Router();
const {
  loginController,
  verify2faLoginController,
  logoutController,
  logoutAllController,
  forgotPasswordController,
  resetPasswordController
} = require("../controllers/authControllers")

const {
  requireAuth
} = require("../middlewares/authMiddleware")

router.post("/login", loginController)
router.post("/login/mfa/verify", verify2faLoginController)
router.post("/forgot-password", forgotPasswordController)
router.post("/reset-password", resetPasswordController)
router.post("/logout", requireAuth, logoutController)
router.post("/logout/all", requireAuth, logoutAllController)

module.exports = router;