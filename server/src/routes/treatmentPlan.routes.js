import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as treatmentPlanController from '../controllers/treatmentPlan.controller.js';
import * as treatmentPlanItemController from '../controllers/treatmentPlanItem.controller.js';
import * as treatmentPlanValidators from '../middlewares/validators/treatmentPlan.validators.js';
import * as treatmentPlanItemValidators from '../middlewares/validators/treatmentPlanItem.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
// Treatment plans
router.get('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_READ_ALL), treatmentPlanController.getAllTreatmentPlansController)
router.get('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_READ), treatmentPlanController.getTreatmentPlanController)
router.post('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_CREATE), treatmentPlanValidators.validateCreateTreatmentPlan, handleValidationErrorsNs.handleValidationErrors, treatmentPlanController.createTreatmentPlanController)
router.patch('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_UPDATE), treatmentPlanValidators.validateUpdateTreatmentPlan, handleValidationErrorsNs.handleValidationErrors, treatmentPlanController.updateTreatmentPlanController)

// Treatments attached to a plan
router.post('/:id/treatments/attach', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_UPDATE), treatmentPlanValidators.validateAttachTreatments, handleValidationErrorsNs.handleValidationErrors, treatmentPlanController.attachTreatmentsToTreatmentPlanController)

// Treatment plan items
router.post('/:id/items/bulk', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_UPDATE), treatmentPlanValidators.validateAddTreatmentPlanItemsBulk, handleValidationErrorsNs.handleValidationErrors, treatmentPlanController.addTreatmentPlanItemsBulkController)
router.post('/:id/items', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_UPDATE), treatmentPlanItemValidators.validateCreateTreatmentPlanItem, handleValidationErrorsNs.handleValidationErrors, treatmentPlanItemController.createTreatmentPlanItemController)
router.patch('/:id/items/:itemId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_UPDATE), treatmentPlanItemValidators.validateEditTreatmentPlanItem, handleValidationErrorsNs.handleValidationErrors, treatmentPlanItemController.editTreatmentPlanItemController)
router.patch('/:id/items/:itemId/relocate', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_UPDATE), treatmentPlanItemValidators.validateRelocateTreatmentPlanItem, handleValidationErrorsNs.handleValidationErrors, treatmentPlanItemController.relocateTreatmentPlanItemController)
router.delete('/:id/items/:itemId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.TREATMENT_PLANS_UPDATE), treatmentPlanItemController.removeTreatmentPlanItemController)

export default router;