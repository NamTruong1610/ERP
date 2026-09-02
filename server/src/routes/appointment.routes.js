import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as appointmentController from '../controllers/appointment.controller.js';
import * as appointmentValidators from '../middlewares/validators/appointment.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.APPOINTMENTS_READ_ALL), appointmentController.getAllAppointmentsController)
router.get('/me', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.APPOINTMENTS_READ), appointmentController.getMyAppointmentsController)
router.get('/patient/:patientId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.APPOINTMENTS_READ), appointmentController.getAppointmentsByPatientController)
router.get('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.APPOINTMENTS_READ), appointmentController.getAppointmentController)
router.post('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.APPOINTMENTS_CREATE), appointmentValidators.validateCreateAppointment, handleValidationErrorsNs.handleValidationErrors, appointmentController.createAppointmentController)
router.patch('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.APPOINTMENTS_UPDATE), appointmentValidators.validateUpdateAppointment, handleValidationErrorsNs.handleValidationErrors, appointmentController.updateAppointmentController)
router.delete('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.APPOINTMENTS_DELETE), appointmentController.deleteAppointmentController)

export default router;