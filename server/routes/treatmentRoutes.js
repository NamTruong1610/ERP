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
const {
  validateCreateTreatment,
  validateUpdateTreatment
} = require('../middlewares/validators/treatmentValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get('/', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_READ_ALL), getAllTreatmentsController)
router.get('/appointment/:appointmentId', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_READ), getTreatmentByAppointmentController)
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_READ), getTreatmentController)
router.post('/', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_CREATE), validateCreateTreatment, handleValidationErrors, createTreatmentController)
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_UPDATE), validateUpdateTreatment, handleValidationErrors, updateTreatmentController)
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENTS_DELETE), deleteTreatmentController)

module.exports = router