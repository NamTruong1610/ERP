import { body } from 'express-validator';
export const validateCreatePaymentAttempt = [
  body('invoiceId')
    .notEmpty().withMessage('Invoice ID is required')
    .isString().withMessage('Invoice ID must be a string'),
  body('itemPayments')
    .isArray({ min: 1 }).withMessage('At least one item payment is required'),
  body('itemPayments.*')
    .isArray({ min: 2, max: 2 }).withMessage('Each item payment must be an [invoiceItemId, amount] pair'),
  body('itemPayments.*.0')
    .isString().withMessage('Invoice item ID must be a string'),
  body('itemPayments.*.1')
    .isFloat({ min: 0.01 }).withMessage('Item payment amount must be a positive number'),
]