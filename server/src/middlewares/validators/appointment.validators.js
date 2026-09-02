import { body, param } from 'express-validator';
const VALID_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED']

export const validateCreateAppointment = [
  body('patientId')
    .notEmpty().withMessage('Patient ID is required')
    .isString().withMessage('Patient ID must be a string'),
  body('dentistId')
    .optional()
    .isString().withMessage('Dentist ID must be a string'),
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid ISO 8601 datetime'),
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string')
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be at most 500 characters')
]

export const validateUpdateAppointment = [
  param('id')
    .notEmpty().withMessage('Appointment ID is required'),
  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid ISO 8601 datetime'),
  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string')
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be at most 500 characters'),
  body('dentistId')
    .optional({ nullable: true })
    .isString().withMessage('Dentist ID must be a string')
]