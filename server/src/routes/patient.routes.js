import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as patientController from '../controllers/patient.controller.js';
import * as patientValidators from '../middlewares/validators/patient.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PATIENTS_READ), patientController.getAllPatientsController)
router.get('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PATIENTS_READ), patientController.getPatientController)
router.post('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PATIENTS_CREATE), patientValidators.validateCreatePatient, handleValidationErrorsNs.handleValidationErrors, patientController.createPatientController)
router.patch('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PATIENTS_UPDATE), patientValidators.validateUpdatePatient, handleValidationErrorsNs.handleValidationErrors, patientController.updatePatientController)
router.delete('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PATIENTS_DELETE), patientController.deletePatientController)

export default router;