import { body, param } from 'express-validator';
const passwordRules = [
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) throw new Error('Passwords do not match')
      return true
    })
]

export const validateUpdateName = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isObject().withMessage('Name must be an object'),
  body('name.fName')
    .optional()
    .isString().withMessage('First name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('First name must be at most 50 characters'),
  body('name.mName')
    .optional()
    .isString().withMessage('Middle name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('Middle name must be at most 50 characters'),
  body('name.lName')
    .optional()
    .isString().withMessage('Last name must be a string')
    .trim()
    .isLength({ max: 50 }).withMessage('Last name must be at most 50 characters')
]

export const validateUpdatePhone = [
  body('phone')
    .notEmpty().withMessage('Phone is required')
    .isMobilePhone().withMessage('Valid phone number is required')
]

export const validateAddAddress = [
  body('address')
    .notEmpty().withMessage('Address is required')
    .isObject().withMessage('Address must be an object'),
  body('address.street')
    .optional()
    .isString().withMessage('Street must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Street must be at most 100 characters'),
  body('address.suburb')
    .optional()
    .isString().withMessage('Suburb must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Suburb must be at most 100 characters'),
  body('address.city')
    .optional()
    .isString().withMessage('City must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('City must be at most 100 characters'),
  body('address.post')
    .optional()
    .isPostalCode('AU').withMessage('Valid Australian postcode is required')
]

export const validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  ...passwordRules
]

export const validateChangeEmail = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
]

export const validateVerifyEmailChange = [
  body('tokenId')
    .notEmpty().withMessage('Token is required')
]

export const validateMfaAction = [
  body('password')
    .notEmpty().withMessage('Password is required'),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric')
]