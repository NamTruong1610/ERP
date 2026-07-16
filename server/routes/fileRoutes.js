// routes/fileRoutes.js
const express = require('express')
const router  = express.Router()

const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')

const {
  preUploadFileController,
  confirmUploadFileController,
  getFilesByPatientController,
  downloadFileController,
  softDeleteFileController,
  hardDeleteFileController
} = require('../controller/fileController')

router.use(requireAuth)

// Static paths before parameterised — /patient/:patientId must be defined
// before /:fileId/confirm and /:fileId/download or Express matches
// 'patient' as the fileId segment
router.post(
  '/patient/:patientId/initiate',
  requirePermission(PERMISSIONS.FILES_UPLOAD),
  preUploadFileController
)

router.get(
  '/patient/:patientId',
  requirePermission(PERMISSIONS.FILES_READ),
  getFilesByPatientController
)

router.post(
  '/:fileId/confirm',
  requirePermission(PERMISSIONS.FILES_UPLOAD),
  confirmUploadFileController
)

router.get(
  '/:fileId/download',
  requirePermission(PERMISSIONS.FILES_READ),
  downloadFileController
)

// Purge before generic delete — /:fileId/purge must be defined before
// /:fileId or 'purge' gets matched as the fileId on DELETE requests
router.delete(
  '/:fileId/purge',
  requirePermission(PERMISSIONS.FILES_PURGE),
  hardDeleteFileController
)

router.delete(
  '/:fileId',
  requirePermission(PERMISSIONS.FILES_DELETE),
  softDeleteFileController
)

module.exports = router