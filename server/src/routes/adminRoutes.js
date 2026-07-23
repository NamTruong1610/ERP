const express = require("express");
const router = express.Router();
const {
  createUserController,
  deleteUserController,
  getAllUsersController,
  getUserController,
  updateUserController,
  suspendUserController,
  reactivateUserController,
  reset2faController,
  resendActivationEmailController,
  assignRoleController,
  removeRoleController,
  forceLogoutUserController
} = require("../controllers/adminController")

const { requireAuth } = require("../middlewares/authMiddleware")
const { requirePermission } = require("../middlewares/rbacMiddleware")
const { PERMISSIONS } = require("../config/RBACConfig")

const {
  validateCreateUser,
  validateUserId,
  validateAssignRole,
  validateRemoveRole,
  validateUpdateUser
} = require('../middlewares/validators/adminValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get("/users", requireAuth, requirePermission(PERMISSIONS.USERS_READ), getAllUsersController)
router.get("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_READ), validateUserId, handleValidationErrors, getUserController)
router.post("/users", requireAuth, requirePermission(PERMISSIONS.USERS_CREATE), validateCreateUser, handleValidationErrors, createUserController)
router.patch("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_UPDATE), validateUpdateUser, handleValidationErrors, updateUserController)
router.delete("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_DELETE), validateUserId, handleValidationErrors, deleteUserController)

router.post("/users/:id/suspend", requireAuth, requirePermission(PERMISSIONS.USERS_SUSPEND), validateUserId, handleValidationErrors, suspendUserController)
router.post("/users/:id/reactivate", requireAuth, requirePermission(PERMISSIONS.USERS_REACTIVATE), validateUserId, handleValidationErrors, reactivateUserController)
router.post("/users/:id/force-logout", requireAuth, requirePermission(PERMISSIONS.USERS_FORCE_LOGOUT), validateUserId, handleValidationErrors, forceLogoutUserController)
router.post("/users/:id/resend-activation", requireAuth, requirePermission(PERMISSIONS.USERS_RESEND_ACTIVATION), validateUserId, handleValidationErrors, resendActivationEmailController)
router.post("/users/:id/reset-2fa", requireAuth, requirePermission(PERMISSIONS.USERS_RESET_2FA), validateUserId, handleValidationErrors, reset2faController)

router.post("/users/:id/roles", requireAuth, requirePermission(PERMISSIONS.USERS_ROLES_MANAGE), validateAssignRole, handleValidationErrors, assignRoleController)
router.delete("/users/:id/roles", requireAuth, requirePermission(PERMISSIONS.USERS_ROLES_MANAGE), validateRemoveRole, handleValidationErrors, removeRoleController)

module.exports = router;