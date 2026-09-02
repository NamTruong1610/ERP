import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as visitController from '../controllers/visit.controller.js';
import * as visitValidators from '../middlewares/validators/visit.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_READ_ALL), visitController.getAllVisitsController)
router.get('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_READ), visitController.getVisitController)

router.post('/from-appointment', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_CREATE), visitValidators.validateCreateVisitFromAppointment, handleValidationErrorsNs.handleValidationErrors, visitController.createVisitFromAppointmentController)
router.post('/walk-in', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_CREATE), visitValidators.validateCreateWalkInVisit, handleValidationErrorsNs.handleValidationErrors, visitController.createWalkInVisitController)

router.patch('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_UPDATE), visitValidators.validateUpdateVisit, handleValidationErrorsNs.handleValidationErrors, visitController.updateVisitController)
router.delete('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_DELETE), visitValidators.validateDeleteVisit, handleValidationErrorsNs.handleValidationErrors, visitController.deleteVisitController)

router.post('/:id/providers', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_UPDATE), visitValidators.validateAddVisitProvider, handleValidationErrorsNs.handleValidationErrors, visitController.addVisitProviderController)
router.patch('/:id/providers/:providerId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_UPDATE), visitValidators.validateEditVisitProviderRole, handleValidationErrorsNs.handleValidationErrors, visitController.editVisitProviderRoleController)
router.delete('/:id/providers/:providerId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.VISITS_UPDATE), visitController.removeVisitProviderController)

export default router;