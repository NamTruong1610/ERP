import express from "express";
const router = express.Router();
import * as activationController from "../controllers/activation.controller.js";
import * as activationValidators from '../middlewares/validators/activation.validators.js';
import * as handleValidationErrorsNs from '../middlewares/validators/handleValidationErrors.js';
router.post('/password', activationValidators.validateSetPassword, handleValidationErrorsNs.handleValidationErrors, activationController.setPasswordController)
router.post('/2fa', activationValidators.validateGet2faSecret, handleValidationErrorsNs.handleValidationErrors, activationController.get2faSecretController)
router.post('/2fa/verify', activationValidators.validateVerify2faSetup, handleValidationErrorsNs.handleValidationErrors, activationController.verify2faSecretSetupController)

export default router;