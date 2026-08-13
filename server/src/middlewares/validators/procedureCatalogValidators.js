const { body } = require('express-validator')

exports.validateCreateProcedure = [
  body('name').notEmpty().withMessage('Name is required').isString().trim().isLength({ max: 200 }),
  body('code').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body('category').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('defaultAmount').isFloat({ min: 0.01 }).withMessage('A valid default amount is required'),
]

exports.validateUpdateProcedure = [
  body('name').optional().isString().trim().notEmpty().withMessage('Name cannot be empty'),
  body('code').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body('category').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('defaultAmount').optional().isFloat({ min: 0.01 }).withMessage('A valid default amount is required'),
]