import express from 'express';
const router = express.Router()
import * as authMiddleware from '../middlewares/auth.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import * as rbacConfig from '../config/rbac.config.js';
import * as createCheckoutSessionControllerNs from '../controllers/createCheckoutSession.controller.js';
import * as paymentAttemptValidators from '../middlewares/validators/paymentAttempt.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.post(
  '/',
  authMiddleware.requireAuth,
  rbacMiddleware.requirePermission(rbacConfig.PERMISSIONS.INVOICES_RECORD_PAYMENT),
  paymentAttemptValidators.validateCreatePaymentAttempt,
  handleValidationErrorsNs.handleValidationErrors,
  createCheckoutSessionControllerNs.createCheckoutSessionController
)

export default router;