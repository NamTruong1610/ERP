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
} = require('../controllers/appointmentControllers')

// Get all appointments — admin only
router.get('/', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ_ALL), getAllAppointmentsController)

// Get own appointments — dentist views their own schedule
router.get('/me', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ), getMyAppointmentsController)

// Get appointments by patient
router.get('/patient/:patientId', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ), getAppointmentsByPatientController)

// Get single appointment
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_READ), getAppointmentController)

// Create appointment
router.post('/', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_CREATE), createAppointmentController)

// Update appointment
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE), updateAppointmentController)

// Delete appointment
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.APPOINTMENTS_DELETE), deleteAppointmentController)

module.exports = router