const { body, param } = require('express-validator')

const VALID_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']

exports.validateCreatePatient = [
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .isString().withMessage('First name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('First name must be at most 50 characters'),
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .isString().withMessage('Last name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('Last name must be at most 50 characters'),
  body('dob')
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom(value => {
      const dob = new Date(value)
      const now = new Date()
      if (dob >= now) throw new Error('Date of birth must be in the past')
      const minDate = new Date('1900-01-01')
      if (dob < minDate) throw new Error('Date of birth is not realistic')
      return true
    }),
  body('gender')
    .notEmpty().withMessage('Gender is required')
    .isIn(VALID_GENDERS).withMessage(`Gender must be one of: ${VALID_GENDERS.join(', ')}`),
  body('phone')
    .optional()
    .isMobilePhone().withMessage('Valid phone number is required'),
  body('email')
    .optional()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('address')
    .optional()
    .isString().withMessage('Address must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Address must be at most 200 characters')
]

exports.validateUpdatePatient = [
  param('id')
    .notEmpty().withMessage('Patient ID is required'),
  body('firstName')
    .optional()
    .isString().withMessage('First name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('First name must be at most 50 characters'),
  body('lastName')
    .optional()
    .isString().withMessage('Last name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('Last name must be at most 50 characters'),
  body('dob')
    .optional()
    .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom(value => {
      const dob = new Date(value)
      if (dob >= new Date()) throw new Error('Date of birth must be in the past')
      return true
    }),
  body('gender')
    .optional()
    .isIn(VALID_GENDERS).withMessage(`Gender must be one of: ${VALID_GENDERS.join(', ')}`),
  body('phone')
    .optional({ values: 'falsy' })
    .isMobilePhone().withMessage('Valid phone number is required'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('address')
    .optional()
    .isString().withMessage('Address must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Address must be at most 200 characters')
]