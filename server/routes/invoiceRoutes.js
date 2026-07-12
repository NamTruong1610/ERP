const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')
const {
  getAllInvoicesController,
  getInvoiceController,
  createInvoiceController,
  updateInvoiceController,
  issueInvoiceController,
  voidInvoiceController,
  deleteInvoiceController
} = require('../controllers/invoiceControllers')
const {
  createInvoiceItemController,
  updateInvoiceItemController,
  deleteInvoiceItemController
} = require('../controllers/invoiceItemController')
const {
  validateCreateInvoice,
  validateUpdateInvoice,
  validateVoidInvoice,
  validateCreateInvoiceItem,
  validateUpdateInvoiceItem,
} = require('../middlewares/validators/invoiceValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.get('/', requireAuth, requirePermission(PERMISSIONS.INVOICES_READ_ALL), getAllInvoicesController)
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.INVOICES_READ), getInvoiceController)
router.post('/', requireAuth, requirePermission(PERMISSIONS.INVOICES_CREATE), validateCreateInvoice, handleValidationErrors, createInvoiceController)
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.INVOICES_UPDATE), validateUpdateInvoice, handleValidationErrors, updateInvoiceController)
router.post('/:id/issue', requireAuth, requirePermission(PERMISSIONS.INVOICES_ISSUE), issueInvoiceController)
router.post('/:id/void', requireAuth, requirePermission(PERMISSIONS.INVOICES_VOID), validateVoidInvoice, handleValidationErrors, voidInvoiceController) 
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.INVOICES_DELETE), deleteInvoiceController)


router.post('/:id/items', requireAuth, requirePermission(PERMISSIONS.INVOICES_UPDATE), validateCreateInvoiceItem, handleValidationErrors, createInvoiceItemController)
router.patch('/:id/items/:itemId', requireAuth, requirePermission(PERMISSIONS.INVOICES_UPDATE), validateUpdateInvoiceItem, handleValidationErrors, updateInvoiceItemController)
router.delete('/:id/items/:itemId', requireAuth, requirePermission(PERMISSIONS.INVOICES_UPDATE), deleteInvoiceItemController)

module.exports = router
