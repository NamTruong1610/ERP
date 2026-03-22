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

router.post("/login", loginController)
router.post("/login/mfa/verify", verify2faLoginController)
router.post("/forgot-password", forgotPasswordController)
router.post("/reset-password", resetPasswordController)
router.post("/logout", logoutController)
router.post("/logout/all", logoutAllController)

module.exports = router;