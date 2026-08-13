const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')

const {
  getAllTreatmentPlansController,
  getTreatmentPlanController,
  createTreatmentPlanController,
  addTreatmentPlanItemsBulkController,
  attachTreatmentsToTreatmentPlanController,
  updateTreatmentPlanController
} = require('../controllers/treatmentPlanController')

const {
  createTreatmentPlanItemController,
  editTreatmentPlanItemController,
  relocateTreatmentPlanItemController,
  removeTreatmentPlanItemController
} = require('../controllers/treatmentPlanItemController')

const {
  validateCreateTreatmentPlan,
  validateAddTreatmentPlanItemsBulk,
  validateAttachTreatments,
  validateUpdateTreatmentPlan
} = require('../middlewares/validators/treatmentPlanValidators')

const {
  validateCreateTreatmentPlanItem,
  validateEditTreatmentPlanItem,
  validateRelocateTreatmentPlanItem
} = require('../middlewares/validators/treatmentPlanItemValidators')

const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

// Treatment plans
router.get('/', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_READ_ALL), getAllTreatmentPlansController)
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_READ), getTreatmentPlanController)
router.post('/', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_CREATE), validateCreateTreatmentPlan, handleValidationErrors, createTreatmentPlanController)
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_UPDATE), validateUpdateTreatmentPlan, handleValidationErrors, updateTreatmentPlanController)

// Treatments attached to a plan
router.post('/:id/treatments/attach', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_UPDATE), validateAttachTreatments, handleValidationErrors, attachTreatmentsToTreatmentPlanController)

// Treatment plan items
router.post('/:id/items/bulk', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_UPDATE), validateAddTreatmentPlanItemsBulk, handleValidationErrors, addTreatmentPlanItemsBulkController)
router.post('/:id/items', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_UPDATE), validateCreateTreatmentPlanItem, handleValidationErrors, createTreatmentPlanItemController)
router.patch('/:id/items/:itemId', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_UPDATE), validateEditTreatmentPlanItem, handleValidationErrors, editTreatmentPlanItemController)
router.patch('/:id/items/:itemId/relocate', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_UPDATE), validateRelocateTreatmentPlanItem, handleValidationErrors, relocateTreatmentPlanItemController)
router.delete('/:id/items/:itemId', requireAuth, requirePermission(PERMISSIONS.TREATMENT_PLANS_UPDATE), removeTreatmentPlanItemController)

module.exports = router