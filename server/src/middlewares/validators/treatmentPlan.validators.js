import { body, param } from 'express-validator';
export const validateCreateTreatmentPlan = [
  body('patientId').notEmpty().withMessage('Patient ID is required').isString(),
  body('title').notEmpty().withMessage('Title is required').isString().trim().isLength({ max: 200 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
]

export const validateAddTreatmentPlanItemsBulk = [
  param('id').notEmpty().withMessage('Treatment plan ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.procedure').notEmpty().withMessage('Procedure is required').isString(),
  body('items.*.estimatedAmount').isFloat({ min: 0.01 }).withMessage('A valid estimated amount is required'),
  body('items.*.toothNumber').optional({ nullable: true }).isInt({ min: 1, max: 32 }).withMessage('Invalid tooth number'),
]

export const validateAttachTreatments = [
  param('id').notEmpty().withMessage('Treatment plan ID is required'),
  body('treatmentIds').isArray({ min: 1 }).withMessage('At least one treatment is required'),
  body('treatmentIds.*').isString().withMessage('Each treatment ID must be a string'),
]

export const validateUpdateTreatmentPlan = [
  param('id').notEmpty().withMessage('Treatment plan ID is required'),
  body('title').optional().isString().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('status').optional().isIn(['ACTIVE', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
]