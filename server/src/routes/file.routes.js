// routes/fileRoutes.js
import express from 'express';
const router  = express.Router()

import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as fileController from '../controllers/file.controller.js';
router.use(authMiddleware.requireAuth)

// Static paths before parameterised — /patient/:patientId must be defined
// before /:fileId/confirm and /:fileId/download or Express matches
// 'patient' as the fileId segment
router.post(
  '/patient/:patientId/initiate',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.FILES_UPLOAD),
  fileController.preUploadFileController
)

router.get(
  '/patient/:patientId',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.FILES_READ),
  fileController.getFilesByPatientController
)

router.post(
  '/:fileId/confirm',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.FILES_UPLOAD),
  fileController.confirmUploadFileController
)

router.get(
  '/:fileId/download',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.FILES_READ),
  fileController.downloadFileController
)

// Purge before generic delete — /:fileId/purge must be defined before
// /:fileId or 'purge' gets matched as the fileId on DELETE requests
router.delete(
  '/:fileId/purge',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.FILES_PURGE),
  fileController.hardDeleteFileController
)

router.delete(
  '/:fileId',
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.FILES_DELETE),
  fileController.softDeleteFileController
)

export default router;