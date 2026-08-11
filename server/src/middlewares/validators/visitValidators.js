const { body, param } = require('express-validator')

const providerArrayRules = [
  body('providers').optional().isArray().withMessage('Providers must be an array'),
  body('providers.*.performerId').if(body('providers').exists()).notEmpty().withMessage('Each provider requires a performerId'),
  body('providers.*.role').if(body('providers').exists()).notEmpty().withMessage('Each provider requires a role'),
]

exports.validateCreateVisitFromAppointment = [
  body('appointmentId').notEmpty().withMessage('Appointment ID is required').isString(),
  body('visitDate').optional().isISO8601().withMessage('Visit date must be a valid ISO 8601 datetime'),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  ...providerArrayRules,
]

exports.validateCreateWalkInVisit = [
  body('patientId').notEmpty().withMessage('Patient ID is required').isString(),
  body('visitDate').optional().isISO8601().withMessage('Visit date must be a valid ISO 8601 datetime'),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  ...providerArrayRules,
]

exports.validateUpdateVisit = [
  param('id').notEmpty().withMessage('Visit ID is required'),
  body('status').optional().isIn(['COMPLETED', 'CANCELLED']).withMessage('Status must be COMPLETED or CANCELLED'),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
]

exports.validateAddVisitProvider = [
  param('id').notEmpty().withMessage('Visit ID is required'),
  body('performerId').notEmpty().withMessage('Performer ID is required').isString(),
  body('role').notEmpty().withMessage('Role is required').isString(),
]

exports.validateEditVisitProviderRole = [
  param('id').notEmpty().withMessage('Visit ID is required'),
  param('providerId').notEmpty().withMessage('Provider ID is required'),
  body('role').notEmpty().withMessage('Role is required').isString(),
]

exports.validateDeleteVisit = [
  param('id').notEmpty().withMessage('Visit ID is required'),
  body('confirm').optional().isBoolean().withMessage('Confirm must be a boolean'),
]