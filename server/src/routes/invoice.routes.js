import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as invoiceController from '../controllers/invoice.controller.js';
import * as invoiceItemController from '../controllers/invoiceItem.controller.js';
import * as invoiceValidators from '../middlewares/validators/invoice.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_READ_ALL), invoiceController.getAllInvoicesController)
router.get('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_READ), invoiceController.getInvoiceController)
router.post('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_CREATE), invoiceValidators.validateCreateInvoice, handleValidationErrorsNs.handleValidationErrors, invoiceController.createInvoiceController)
router.patch('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_UPDATE), invoiceValidators.validateUpdateInvoice, handleValidationErrorsNs.handleValidationErrors, invoiceController.updateInvoiceController)
router.post('/:id/issue', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_ISSUE), invoiceController.issueInvoiceController)
router.post('/:id/void', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_VOID), invoiceValidators.validateVoidInvoice, handleValidationErrorsNs.handleValidationErrors, invoiceController.voidInvoiceController) 
router.delete('/:id', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_DELETE), invoiceController.deleteInvoiceController)


router.post('/:id/items', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_UPDATE), invoiceValidators.validateCreateInvoiceItem, handleValidationErrorsNs.handleValidationErrors, invoiceItemController.createInvoiceItemController)
router.patch('/:id/items/:itemId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_UPDATE), invoiceValidators.validateUpdateInvoiceItem, handleValidationErrorsNs.handleValidationErrors, invoiceItemController.updateInvoiceItemController)
router.delete('/:id/items/:itemId', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_UPDATE), invoiceItemController.deleteInvoiceItemController)

export default router;