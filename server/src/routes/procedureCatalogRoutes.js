const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')

const {
  getAllProceduresController,
  getProcedureController,
  createProcedureController,
  updateProcedureController,
  deactivateProcedureController,
  reactivateProcedureController
} = require('../controllers/procedureCatalogController')

const { validateCreateProcedure, validateUpdateProcedure } = require('../middlewares/validators/procedureCatalogValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get('/', requireAuth, requirePermission(PERMISSIONS.PROCEDURES_READ_ALL), getAllProceduresController)
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.PROCEDURES_READ), getProcedureController)

router.post('/', requireAuth, requirePermission(PERMISSIONS.PROCEDURES_CREATE), validateCreateProcedure, handleValidationErrors, createProcedureController)
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.PROCEDURES_UPDATE), validateUpdateProcedure, handleValidationErrors, updateProcedureController)
router.patch('/:id/deactivate', requireAuth, requirePermission(PERMISSIONS.PROCEDURES_UPDATE), deactivateProcedureController)
router.patch('/:id/reactivate', requireAuth, requirePermission(PERMISSIONS.PROCEDURES_UPDATE), reactivateProcedureController)

module.exports = router