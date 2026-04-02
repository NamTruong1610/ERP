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
} = require("../controllers/adminControllers")

const { requireAuth } = require("../middlewares/authMiddleware")
const { requirePermission } = require("../middlewares/rbacMiddleware")
const { PERMISSIONS } = require("../config/RBACConfig")

router.get("/users", requireAuth, requirePermission(PERMISSIONS.USERS_READ), getAllUsersController)
router.get("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_READ), getUserController)
router.post("/users", requireAuth, requirePermission(PERMISSIONS.USERS_CREATE), createUserController)
router.patch("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_UPDATE), updateUserController)
router.delete("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_DELETE), deleteUserController)

router.post("/users/:id/suspend", requireAuth, requirePermission(PERMISSIONS.USERS_SUSPEND), suspendUserController)
router.post("/users/:id/reactivate", requireAuth, requirePermission(PERMISSIONS.USERS_REACTIVATE), reactivateUserController)
router.post("/users/:id/force-logout", requireAuth, requirePermission(PERMISSIONS.USERS_FORCE_LOGOUT), forceLogoutUserController)
router.post("/users/:id/resend-activation", requireAuth, requirePermission(PERMISSIONS.USERS_RESEND_ACTIVATION), resendActivationEmailController)
router.post("/users/:id/reset-2fa", requireAuth, requirePermission(PERMISSIONS.USERS_RESET_2FA), reset2faController)

router.post("/users/:id/roles", requireAuth, requirePermission(PERMISSIONS.USERS_ROLES_MANAGE), assignRoleController)
router.delete("/users/:id/roles", requireAuth, requirePermission(PERMISSIONS.USERS_ROLES_MANAGE), removeRoleController)

module.exports = router;