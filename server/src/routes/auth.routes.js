import express from "express";
const router = express.Router();
import * as authController from "../controllers/auth.controller.js";
import * as userRepository from '../repositories/user.repository.js';
import * as authMiddleware from "../middlewares/auth.middleware.js";
import * as rateLimitMiddleware from '../middlewares/rateLimit.middleware.js';
import * as authValidators from '../middlewares/validators/auth.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.get('/me', authMiddleware.requireAuth, authController.getMeController)
router.post('/login', rateLimitMiddleware.loginLimiter, authValidators.validateLogin, handleValidationErrorsNs.handleValidationErrors, authController.loginController)
router.post('/login/mfa', rateLimitMiddleware.mfaVerifyLimiter, authValidators.validateMfaLogin, handleValidationErrorsNs.handleValidationErrors, authController.verify2faLoginController)
router.post('/logout', authMiddleware.requireAuth, authController.logoutController)
router.post('/logout/all', authMiddleware.requireAuth, authController.logoutAllController)
router.post('/forgot-password', rateLimitMiddleware.forgotPasswordLimiter, authValidators.validateForgotPassword, handleValidationErrorsNs.handleValidationErrors, authController.forgotPasswordController)
router.post('/reset-password', rateLimitMiddleware.resetPasswordLimiter, authValidators.validateResetPassword, handleValidationErrorsNs.handleValidationErrors, authController.resetPasswordController)

export default router;