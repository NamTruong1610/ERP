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

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userRecord = await findUserById(req.user.id)
    if (!userRecord || userRecord.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Unauthenticated' })
    }
    return res.status(200).json({
      id: userRecord.id,
      roles: userRecord.roles
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router;