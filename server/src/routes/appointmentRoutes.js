const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')
const {
  getAllAppointmentsController,
  getAppointmentController,
  getMyAppointmentsController,
  getAppointmentsByPatientController,
  createAppointmentController,
  updateAppointmentController,
  deleteAppointmentController
} = require('../controllers/appointmentController')
const {
  validateCreateAppointment,
  validateUpdateAppointment
} = require('../middlewares/validators/appointmentValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get('/', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ_ALL), getAllAppointmentsController)
router.get('/me', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ), getMyAppointmentsController)
router.get('/patient/:patientId', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ), getAppointmentsByPatientController)
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ), getAppointmentController)
router.post('/', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_CREATE), validateCreateAppointment, handleValidationErrors, createAppointmentController)
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE), validateUpdateAppointment, handleValidationErrors, updateAppointmentController)
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_DELETE), deleteAppointmentController)

module.exports = router