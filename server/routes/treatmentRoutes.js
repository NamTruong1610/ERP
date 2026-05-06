const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')
const {
  getAllTreatmentsController,
  getTreatmentController,
  getTreatmentByAppointmentController,
  createTreatmentController,
  updateTreatmentController,
  deleteTreatmentController
} = require('../controllers/treatmentControllers')

// Get all treatments — admin only
router.get('/', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_READ_ALL), getAllTreatmentsController)

// Get treatment by appointment
router.get('/appointment/:appointmentId', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_READ), getTreatmentByAppointmentController)

// Get single treatment
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_READ), getTreatmentController)

// Create treatment
router.post('/', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_CREATE), createTreatmentController)

// Update treatment
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_UPDATE), updateTreatmentController)

// Delete treatment
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_DELETE), deleteTreatmentController)

module.exports = router