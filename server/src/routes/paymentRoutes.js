const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')
const {
  createPaymentController,
  getInvoicePaymentLedgerController,
  voidPaymentController,
} = require('../controller/paymentControllers')
const {
  validateCreatePayment,
  validateGetInvoiceLedger,
  validateVoidPayment,
} = require('../middlewares/validators/paymentValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.post('/', requireAuth, requirePermission(PERMISSIONS.INVOICES_RECORD_PAYMENT), validateCreatePayment, handleValidationErrors, createPaymentController)
router.get('/invoice/:invoiceId/ledger', requireAuth, requirePermission(PERMISSIONS.INVOICES_READ), validateGetInvoiceLedger, handleValidationErrors, getInvoicePaymentLedgerController)
router.post('/:paymentId/void', requireAuth, requirePermission(PERMISSIONS.PAYMENTS_REVERSE), validateVoidPayment, handleValidationErrors, voidPaymentController)

module.exports = router