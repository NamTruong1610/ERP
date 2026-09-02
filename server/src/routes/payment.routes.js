import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as paymentController from '../controllers/payment.controller.js';
import * as paymentValidators from '../middlewares/validators/payment.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.post('/', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_RECORD_PAYMENT), paymentValidators.validateCreatePayment, handleValidationErrorsNs.handleValidationErrors, paymentController.createPaymentController)
router.get('/invoice/:invoiceId/ledger', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_READ), paymentValidators.validateGetInvoiceLedger, handleValidationErrorsNs.handleValidationErrors, paymentController.getInvoicePaymentLedgerController)
router.post('/:paymentId/void', authMiddleware.requireAuth, rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.PAYMENTS_REVERSE), paymentValidators.validateVoidPayment, handleValidationErrorsNs.handleValidationErrors, paymentController.voidPaymentController)

export default router;