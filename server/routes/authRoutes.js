const express = require("express");
const router = express.Router();
const {
  loginController,
  verify2faLoginController,
  logoutController,
  logoutAllController
} = require("../controllers/authControllers")

router.post("/login", loginController)
router.post("/login/mfa/verify", verify2faLoginController)
router.post("/logout", logoutController)
router.post("/logout/all", logoutAllController)

module.exports = router;