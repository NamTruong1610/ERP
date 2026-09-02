import { body, param } from 'express-validator';
const billedToFields = [
  body('billedToName').optional().isString().trim().isLength({ max: 200 }),
  body('billedToEmail').optional().isString().trim().isEmail().withMessage('Billed-to email must be a valid email'),
  body('billedToPhone').optional().isString().trim().isLength({ max: 30 }),
  body('billedToAddress').optional().isString().trim().isLength({ max: 500 }),
]

export const validateCreateInvoice = [
  body('patientId')
    .notEmpty().withMessage('Patient ID is required')
    .isString().withMessage('Patient ID must be a string'),
  body('treatmentIds')
    .isArray({ min: 1 }).withMessage('At least one treatment is required'),
  body('treatmentIds.*')
    .isString().withMessage('Each treatment ID must be a string'),
  body('dueAt')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid date'),
  ...billedToFields
]

export const validateUpdateInvoice = [
  param('id')
    .notEmpty().withMessage('Invoice ID is required'),
  body('dueAt')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid date'),
  body('notes')
    .optional()
    .isString().trim().isLength({ max: 1000 }).withMessage('Notes must be at most 1000 characters'),
  ...billedToFields
]

export const validateCreateInvoiceItem = [
  param('id')
    .notEmpty().withMessage('Invoice ID is required'),
  body('treatmentId')
    .optional({ nullable: true })
    .isString().withMessage('Treatment ID must be a string'),
  body('description')
    .optional()
    .isString().trim().isLength({ max: 200 }).withMessage('Description must be at most 200 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
]

export const validateUpdateInvoiceItem = [
  param('id')
    .notEmpty().withMessage('Invoice ID is required'),
  param('itemId')
    .notEmpty().withMessage('Item ID is required'),
  body('treatmentId')
    .optional({ nullable: true })
    .isString().withMessage('Treatment ID must be a string'),
  body('description')
    .optional()
    .isString().trim().isLength({ max: 200 }).withMessage('Description must be at most 200 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
]

export const validateVoidInvoice = [
  param('id')
    .notEmpty().withMessage('Invoice ID is required'),
  body('reason')
    .notEmpty().withMessage('A reason is required to void an invoice')
    .isString().trim().isLength({ max: 500 }).withMessage('Reason must be at most 500 characters'),
]