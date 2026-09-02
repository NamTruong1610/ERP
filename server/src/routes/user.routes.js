import express from "express";
const router = express.Router();
import * as authMiddleware from "../middlewares/auth.middleware.js";
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as userController from "../controllers/user.controller.js";
import * as userValidators from '../middlewares/validators/user.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get("/profile", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_READ), userController.getProfileController)
router.get('/dentists', authMiddleware.requireAuth, userController.getDentistsController)

router.post("/name", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_UPDATE), userValidators.validateUpdateName, handleValidationErrorsNs.handleValidationErrors, userController.updateNameController)

router.post('/phones', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_PHONES_MANAGE), userValidators.validateUpdatePhone, handleValidationErrorsNs.handleValidationErrors, userController.updatePhonesController)
router.delete('/phones/:phone', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_PHONES_MANAGE), userController.removePhoneController)

router.post('/addresses', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_ADDRESSES_MANAGE), userValidators.validateAddAddress, handleValidationErrorsNs.handleValidationErrors, userController.addAddressController)
router.patch('/addresses/:addressId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_ADDRESSES_MANAGE), userValidators.validateAddAddress, handleValidationErrorsNs.handleValidationErrors, userController.updateAddressController)
router.delete('/addresses/:addressId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_ADDRESSES_MANAGE), userController.removeAddressController)

router.post('/password', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_PASSWORD_CHANGE), userValidators.validateChangePassword, handleValidationErrorsNs.handleValidationErrors, userController.changePasswordController)

router.post('/email', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_EMAIL_CHANGE), userValidators.validateChangeEmail, handleValidationErrorsNs.handleValidationErrors, userController.changeEmailController)
router.post('/email/verify', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROFILE_EMAIL_CHANGE), userValidators.validateVerifyEmailChange, handleValidationErrorsNs.handleValidationErrors, userController.verifyEmailChangeController)

router.post('/2fa/disable', authMiddleware.requireAuth, userValidators.validateMfaAction, handleValidationErrorsNs.handleValidationErrors, userController.disable2faController)
router.post('/2fa/enable', authMiddleware.requireAuth, userValidators.validateMfaAction, handleValidationErrorsNs.handleValidationErrors, userController.enable2faController)

export default router;