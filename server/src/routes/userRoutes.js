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
  enable2faController,
  getDentistsController
} = require("../controllers/userController")
const {
  validateUpdateName,
  validateUpdatePhone,
  validateAddAddress,
  validateChangePassword,
  validateChangeEmail,
  validateVerifyEmailChange,
  validateMfaAction
} = require('../middlewares/validators/userValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get("/profile", requireAuth, requirePermission(PERMISSIONS.PROFILE_READ), getProfileController)
router.get('/dentists', requireAuth, getDentistsController)

router.post("/name", requireAuth, requirePermission(PERMISSIONS.PROFILE_UPDATE), validateUpdateName, handleValidationErrors, updateNameController)

router.post('/phones', requireAuth, requirePermission(PERMISSIONS.PROFILE_PHONES_MANAGE), validateUpdatePhone, handleValidationErrors, updatePhonesController)
router.delete('/phones/:phone', requireAuth, requirePermission(PERMISSIONS.PROFILE_PHONES_MANAGE), removePhoneController)

router.post('/addresses', requireAuth, requirePermission(PERMISSIONS.PROFILE_ADDRESSES_MANAGE), validateAddAddress, handleValidationErrors, addAddressController)
router.patch('/addresses/:addressId', requireAuth, requirePermission(PERMISSIONS.PROFILE_ADDRESSES_MANAGE), validateAddAddress, handleValidationErrors, updateAddressController)
router.delete('/addresses/:addressId', requireAuth, requirePermission(PERMISSIONS.PROFILE_ADDRESSES_MANAGE), removeAddressController)

router.post('/password', requireAuth, requirePermission(PERMISSIONS.PROFILE_PASSWORD_CHANGE), validateChangePassword, handleValidationErrors, changePasswordController)

router.post('/email', requireAuth, requirePermission(PERMISSIONS.PROFILE_EMAIL_CHANGE), validateChangeEmail, handleValidationErrors, changeEmailController)
router.post('/email/verify', requireAuth, requirePermission(PERMISSIONS.PROFILE_EMAIL_CHANGE), validateVerifyEmailChange, handleValidationErrors, verifyEmailChangeController)

router.post('/2fa/disable', requireAuth, validateMfaAction, handleValidationErrors, disable2faController)
router.post('/2fa/enable', requireAuth, validateMfaAction, handleValidationErrors, enable2faController)

module.exports = router;