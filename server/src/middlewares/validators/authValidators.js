const { body } = require('express-validator')

exports.validateLogin = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  body('rememberMe')
    .optional()
    .isBoolean().withMessage('rememberMe must be a boolean')
]

exports.validateMfaLogin = [
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  body('mfaLoginTokenId')
    .notEmpty().withMessage('MFA login token is required')
]

exports.validateForgotPassword = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
]

exports.validateResetPassword = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) throw new Error('Passwords do not match')
      return true
    }),
  body('recoveryToken')
    .notEmpty().withMessage('Recovery token is required')
]