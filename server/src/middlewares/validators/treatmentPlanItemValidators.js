const { body, param } = require('express-validator')

exports.validateCreateTreatmentPlanItem = [
  param('id').notEmpty().withMessage('Treatment plan ID is required'),
  body('procedure').notEmpty().withMessage('Procedure is required').isString(),
  body('estimatedAmount').isFloat({ min: 0.01 }).withMessage('A valid estimated amount is required'),
  body('toothNumber').optional({ nullable: true }).isInt({ min: 1, max: 32 }).withMessage('Invalid tooth number'),
]

exports.validateEditTreatmentPlanItem = [
  param('id').notEmpty().withMessage('Treatment plan ID is required'),
  param('itemId').notEmpty().withMessage('Item ID is required'),
  body('procedure').optional().isString().trim().notEmpty().withMessage('Procedure cannot be empty'),
  body('estimatedAmount').optional().isFloat({ min: 0.01 }).withMessage('A valid estimated amount is required'),
  body('toothNumber').optional({ nullable: true }).isInt({ min: 1, max: 32 }).withMessage('Invalid tooth number'),
]

exports.validateRelocateTreatmentPlanItem = [
  param('id').notEmpty().withMessage('Treatment plan ID is required'),
  param('itemId').notEmpty().withMessage('Item ID is required'),
  body('treatmentPlanId').notEmpty().withMessage('Target treatment plan ID is required').isString(),
]