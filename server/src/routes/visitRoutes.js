const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')

const {
  getAllVisitsController,
  getVisitController,
  createVisitFromAppointmentController,
  createWalkInVisitController,
  updateVisitController,
  addVisitProviderController,
  editVisitProviderRoleController,
  removeVisitProviderController,
  deleteVisitController
} = require('../controllers/visitController')

const {
  validateCreateVisitFromAppointment,
  validateCreateWalkInVisit,
  validateUpdateVisit,
  validateAddVisitProvider,
  validateEditVisitProviderRole,
  validateDeleteVisit
} = require('../middlewares/validators/visitValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get('/', requireAuth, requirePermission(PERMISSIONS.VISITS_READ_ALL), getAllVisitsController)
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.VISITS_READ), getVisitController)

router.post('/from-appointment', requireAuth, requirePermission(PERMISSIONS.VISITS_CREATE), validateCreateVisitFromAppointment, handleValidationErrors, createVisitFromAppointmentController)
router.post('/walk-in', requireAuth, requirePermission(PERMISSIONS.VISITS_CREATE), validateCreateWalkInVisit, handleValidationErrors, createWalkInVisitController)

router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.VISITS_UPDATE), validateUpdateVisit, handleValidationErrors, updateVisitController)
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.VISITS_DELETE), validateDeleteVisit, handleValidationErrors, deleteVisitController)

router.post('/:id/providers', requireAuth, requirePermission(PERMISSIONS.VISITS_UPDATE), validateAddVisitProvider, handleValidationErrors, addVisitProviderController)
router.patch('/:id/providers/:providerId', requireAuth, requirePermission(PERMISSIONS.VISITS_UPDATE), validateEditVisitProviderRole, handleValidationErrors, editVisitProviderRoleController)
router.delete('/:id/providers/:providerId', requireAuth, requirePermission(PERMISSIONS.VISITS_UPDATE), removeVisitProviderController)

module.exports = router