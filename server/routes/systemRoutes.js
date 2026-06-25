const express = require('express')
const router = express.Router()

const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')

const {
  getAuditLogsController,
  getAllSessionsController,
  revokeSessionController,
  revokeAllSessionsController,
  getDeletedUsersController,
  restoreUserController,
  purgeUserController
} = require('../controllers/systemControllers')

router.use(requireAuth)


router.get(
  '/audit',
  requirePermission(PERMISSIONS.AUDIT_READ),
  getAuditLogsController
)


router.get(
  '/sessions',
  requirePermission(PERMISSIONS.SESSIONS_READ_ALL),
  getAllSessionsController
)

router.delete(
  '/sessions',
  requirePermission(PERMISSIONS.SESSIONS_REVOKE_ALL),
  revokeAllSessionsController
)

router.delete(
  '/sessions/:sessionId',
  requirePermission(PERMISSIONS.SESSIONS_REVOKE_ALL),
  revokeSessionController
)

router.get(
  '/users/deleted',
  requirePermission(PERMISSIONS.DELETED_USERS_READ),
  getDeletedUsersController
)

router.post(
  '/users/:id/restore',
  requirePermission(PERMISSIONS.DELETED_USERS_RESTORE),
  restoreUserController
)

router.delete(
  '/users/:id/purge',
  requirePermission(PERMISSIONS.DELETED_USERS_PURGE),
  purgeUserController
)

module.exports = router