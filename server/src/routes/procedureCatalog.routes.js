import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as procedureCatalogController from '../controllers/procedureCatalog.controller.js';
import * as procedureCatalogValidators from '../middlewares/validators/procedureCatalog.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROCEDURES_READ_ALL), procedureCatalogController.getAllProceduresController)
router.get('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROCEDURES_READ), procedureCatalogController.getProcedureController)

router.post('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROCEDURES_CREATE), procedureCatalogValidators.validateCreateProcedure, handleValidationErrorsNs.handleValidationErrors, procedureCatalogController.createProcedureController)
router.patch('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROCEDURES_UPDATE), procedureCatalogValidators.validateUpdateProcedure, handleValidationErrorsNs.handleValidationErrors, procedureCatalogController.updateProcedureController)
router.patch('/:id/deactivate', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROCEDURES_UPDATE), procedureCatalogController.deactivateProcedureController)
router.patch('/:id/reactivate', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PROCEDURES_UPDATE), procedureCatalogController.reactivateProcedureController)

export default router;