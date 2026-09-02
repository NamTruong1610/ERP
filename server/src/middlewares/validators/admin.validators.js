import { body, param } from 'express-validator';
const VALID_ROLES = ['STAFF', 'ADMIN', 'SUPER_ADMIN']

export const validateCreateUser = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
]

export const validateUserId = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .isString().withMessage('User ID must be a string')
]

export const validateAssignRole = [
  param('id')
    .notEmpty().withMessage('User ID is required'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`)
]

export const validateRemoveRole = [
  param('id')
    .notEmpty().withMessage('User ID is required'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`)
]

export const validateUpdateUser = [
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