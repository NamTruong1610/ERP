import { body, param } from 'express-validator';
export const validateCreatePayment = [
  body('invoiceId')
    .notEmpty().withMessage('Invoice ID is required')
    .isString().withMessage('Invoice ID must be a string'),
  body('method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER']).withMessage('Invalid payment method'),
  body('note')
    .optional({ nullable: true })
    .isString().trim().isLength({ max: 500 }).withMessage('Note must be at most 500 characters'),
  body('itemPayments')
    .isArray({ min: 1 }).withMessage('At least one item payment is required'),
  body('itemPayments.*')
    .isArray({ min: 2, max: 2 }).withMessage('Each item payment must be an [invoiceItemId, amount] pair'),
  body('itemPayments.*.0')
    .isString().withMessage('Invoice item ID must be a string'),
  body('itemPayments.*.1')
    .isFloat({ min: 0.01 }).withMessage('Item payment amount must be a positive number'),
]

export const validateGetInvoiceLedger = [
  param('invoiceId')
    .notEmpty().withMessage('Invoice ID is required'),
]

export const validateVoidPayment = [
  param('paymentId')
    .notEmpty().withMessage('Payment ID is required'),
  body('reason')
    .notEmpty().withMessage('A reason is required to void a payment')
    .isString().trim().isLength({ max: 500 }).withMessage('Reason must be at most 500 characters'),
]