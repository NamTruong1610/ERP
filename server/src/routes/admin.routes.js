import express from "express";
const router = express.Router();
import * as adminController from "../controllers/admin.controller.js";
import * as authMiddleware from "../middlewares/auth.middleware.js";
import * as rbacMiddleware from "../middlewares/rbac.middleware.js";
import * as rbacConfig from "../config/rbac.config.js";
import * as adminValidators from '../middlewares/validators/admin.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get("/users", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_READ), adminController.getAllUsersController)
router.get("/users/:id", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_READ), adminValidators.validateUserId, handleValidationErrorsNs.handleValidationErrors, adminController.getUserController)
router.post("/users", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_CREATE), adminValidators.validateCreateUser, handleValidationErrorsNs.handleValidationErrors, adminController.createUserController)
router.patch("/users/:id", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_UPDATE), adminValidators.validateUpdateUser, handleValidationErrorsNs.handleValidationErrors, adminController.updateUserController)
router.delete("/users/:id", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_DELETE), adminValidators.validateUserId, handleValidationErrorsNs.handleValidationErrors, adminController.deleteUserController)

router.post("/users/:id/suspend", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_SUSPEND), adminValidators.validateUserId, handleValidationErrorsNs.handleValidationErrors, adminController.suspendUserController)
router.post("/users/:id/reactivate", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_REACTIVATE), adminValidators.validateUserId, handleValidationErrorsNs.handleValidationErrors, adminController.reactivateUserController)
router.post("/users/:id/force-logout", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_FORCE_LOGOUT), adminValidators.validateUserId, handleValidationErrorsNs.handleValidationErrors, adminController.forceLogoutUserController)
router.post("/users/:id/resend-activation", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_RESEND_ACTIVATION), adminValidators.validateUserId, handleValidationErrorsNs.handleValidationErrors, adminController.resendActivationEmailController)
router.post("/users/:id/reset-2fa", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_RESET_2FA), adminValidators.validateUserId, handleValidationErrorsNs.handleValidationErrors, adminController.reset2faController)

router.post("/users/:id/roles", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_ROLES_MANAGE), adminValidators.validateAssignRole, handleValidationErrorsNs.handleValidationErrors, adminController.assignRoleController)
router.delete("/users/:id/roles", authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_ROLES_MANAGE), adminValidators.validateRemoveRole, handleValidationErrorsNs.handleValidationErrors, adminController.removeRoleController)

export default router;