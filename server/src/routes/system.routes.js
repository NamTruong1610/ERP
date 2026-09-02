import express from 'express';
const router = express.Router()

import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as systemController from '../controllers/system.controller.js';
router.use(authMiddleware.requireAuth)


router.get(
  '/audit',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.AUDIT_READ),
  systemController.getAuditLogsController
)


router.get(
  '/sessions',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.SESSIONS_READ_ALL),
  systemController.getAllSessionsController
)

router.delete(
  '/sessions',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.SESSIONS_REVOKE_ALL),
  systemController.revokeAllSessionsController
)

router.delete(
  '/sessions/:sessionId',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.SESSIONS_REVOKE_ALL),
  systemController.revokeSessionController
)

router.get(
  '/users/deleted',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.DELETED_USERS_READ),
  systemController.getDeletedUsersController
)

router.post(
  '/users/:id/restore',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.DELETED_USERS_RESTORE),
  systemController.restoreUserController
)

router.delete(
  '/users/:id/purge',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.DELETED_USERS_PURGE),
  systemController.purgeUserController
)

export default router;