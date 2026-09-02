// routes/statsRoutes.js
import express from 'express';
const router  = express.Router()

import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as statsController from '../controllers/stats.controller.js';
router.use(authMiddleware.requireAuth)

router.get('/me', statsController.getMyStatsController)

router.get(
  '/clinic',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.USERS_READ),
  statsController.getClinicStatsController
)

router.get(
  '/system',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.SYSTEM_CONFIG_READ),
  statsController.getSystemStatsController
)

export default router;