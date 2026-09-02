import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as treatmentController from '../controllers/treatment.controller.js';
import * as treatmentValidators from '../middlewares/validators/treatment.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_READ_ALL), treatmentController.getAllTreatmentsController)
router.get('/visit/:visitId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_READ), treatmentController.getTreatmentsByVisitController)
router.get('/patient/:patientId/unbilled', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_READ), treatmentController.getUnbilledTreatmentsController)
router.get('/patient/:patientId/all', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_READ), treatmentController.getAllTreatmentsByPatientController)
router.get('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_READ), treatmentController.getTreatmentController)
router.post('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_CREATE), treatmentValidators.validateCreateTreatment, handleValidationErrorsNs.handleValidationErrors, treatmentController.createTreatmentController)
router.patch('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_UPDATE), treatmentValidators.validateUpdateTreatment, handleValidationErrorsNs.handleValidationErrors, treatmentController.updateTreatmentController)
router.delete('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENTS_DELETE), treatmentController.deleteTreatmentController)

export default router;