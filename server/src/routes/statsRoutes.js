// routes/statsRoutes.js
const express = require('express')
const router  = express.Router()

const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')

const {
  getMyStatsController,
  getClinicStatsController,
  getSystemStatsController
} = require('../controllers/statsController')

router.use(requireAuth)

router.get('/me', getMyStatsController)

router.get(
  '/clinic',
  requirePermission(PERMISSIONS.USERS_READ),
  getClinicStatsController
)

router.get(
  '/system',
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_READ),
  getSystemStatsController
)

module.exports = router