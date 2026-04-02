const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware")

const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')
const {
  getProfileController,
  updateNameController,
  updatePhonesController,
  removePhoneController,
  addAddressController,
  updateAddressController,
  removeAddressController,
  changePasswordController,
  changeEmailController,
  verifyEmailChangeController,
  disable2faController,
  enable2faController
} = require("../controllers/userControllers")

router.get("/profile", requireAuth, requirePermission(PERMISSIONS.PROFILE_READ), getProfileController)
router.post("/name", requireAuth, requirePermission(PERMISSIONS.PROFILE_UPDATE), updateNameController)

// Phones
router.post('/phones', requireAuth, requirePermission(PERMISSIONS.PROFILE_PHONES_MANAGE), updatePhonesController)
router.delete('/phones/:phone', requireAuth, requirePermission(PERMISSIONS.PROFILE_PHONES_MANAGE), removePhoneController)

// Addresses
router.post('/addresses', requireAuth, requirePermission(PERMISSIONS.PROFILE_ADDRESSES_MANAGE), addAddressController)
router.patch('/addresses/:addressId', requireAuth, requirePermission(PERMISSIONS.PROFILE_ADDRESSES_MANAGE), updateAddressController)
router.delete('/addresses/:addressId', requireAuth, requirePermission(PERMISSIONS.PROFILE_ADDRESSES_MANAGE), removeAddressController)

// Password
router.post('/password', requireAuth, requirePermission(PERMISSIONS.PROFILE_PASSWORD_CHANGE), changePasswordController)

// Email
router.post('/email', requireAuth, requirePermission(PERMISSIONS.PROFILE_EMAIL_CHANGE), changeEmailController)
router.post('/email/verify', requireAuth, requirePermission(PERMISSIONS.PROFILE_EMAIL_CHANGE), verifyEmailChangeController)

// 2FA
router.post('/2fa/disable', requireAuth, disable2faController)
router.post('/2fa/enable', requireAuth, enable2faController)


module.exports = router;