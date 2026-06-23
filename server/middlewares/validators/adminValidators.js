const { body, param } = require('express-validator')

const VALID_ROLES = ['STAFF', 'ADMIN', 'SUPER_ADMIN']

exports.validateCreateUser = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
]

exports.validateUserId = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .isString().withMessage('User ID must be a string')
]

exports.validateAssignRole = [
  param('id')
    .notEmpty().withMessage('User ID is required'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`)
]

exports.validateRemoveRole = [
  param('id')
    .notEmpty().withMessage('User ID is required'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`)
]

exports.validateUpdateUser = [
  param('id')
    .notEmpty().withMessage('User ID is required'),
  body('email')
    .optional()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('name')
    .optional()
    .isObject().withMessage('Name must be an object'),
  body('name.fName')
    .optional()
    .isString().withMessage('First name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('First name must be at most 50 characters'),
  body('name.lName')
    .optional()
    .isString().withMessage('Last name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('Last name must be at most 50 characters'),
  body('phones')
    .optional()
    .isArray().withMessage('Phones must be an array'),
  body('phones.*')
    .optional()
    .isMobilePhone().withMessage('Each phone must be a valid phone number')
]