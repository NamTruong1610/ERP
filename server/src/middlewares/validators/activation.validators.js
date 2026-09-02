import { body } from 'express-validator';
export const validateSetPassword = [
  body('activationToken')
    .notEmpty().withMessage('Activation token is required'),
  body('password')
    .if(body('password').exists({ checkNull: true }))
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('confirmPassword')
    .if(body('password').exists({ checkNull: true }))
    .custom((value, { req }) => {
      if (req.body.password && value !== req.body.password) {
        throw new Error('Passwords do not match')
      }
      return true
    })
]

export const validateGet2faSecret = [
  body('activationToken')
    .notEmpty().withMessage('Activation token is required'),
  body('mfaToken')
    .notEmpty().withMessage('MFA token is required')
]

export const validateVerify2faSetup = [
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  body('activationToken')
    .notEmpty().withMessage('Activation token is required'),
  body('mfaToken')
    .notEmpty().withMessage('MFA token is required')
]