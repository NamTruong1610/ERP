const { body, param } = require('express-validator')

exports.validateCreateTreatment = [
  body('appointmentId')
    .notEmpty().withMessage('Appointment ID is required')
    .isString().withMessage('Appointment ID must be a string'),
  body('procedure')
    .notEmpty().withMessage('Procedure is required')
    .isString().withMessage('Procedure must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Procedure must be at most 200 characters'),
  body('toothNumber')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 32 }).withMessage('Tooth number must be between 1 and 32'),
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string')
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be at most 500 characters'),
  body('cost')
    .notEmpty().withMessage('Cost is required')
    .isFloat({ min: 0 }).withMessage('Cost must be a positive number')
]

exports.validateUpdateTreatment = [
  param('id')
    .notEmpty().withMessage('Treatment ID is required'),
  body('procedure')
    .optional()
    .isString().withMessage('Procedure must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Procedure must be at most 200 characters'),
  body('toothNumber')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 32 }).withMessage('Tooth number must be between 1 and 32'),
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string')
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be at most 500 characters'),
  body('cost')
    .optional()
    .isFloat({ min: 0 }).withMessage('Cost must be a positive number')
]