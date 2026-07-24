const express = require("express");
const router = express.Router();
const {
  setPasswordController,
  get2faSecretController,
  verify2faSecretSetupController
} = require("../controllers/activationController")

const {
  validateSetPassword,
  validateGet2faSecret,
  validateVerify2faSetup
} = require('../middlewares/validators/activationValidators')
const { handleValidationErrors } = require('../middlewares/validators/handleValidationErrors')

router.post('/password', validateSetPassword, handleValidationErrors, setPasswordController)
router.post('/2fa', validateGet2faSecret, handleValidationErrors, get2faSecretController)
router.post('/2fa/verify', validateVerify2faSetup, handleValidationErrors, verify2faSecretSetupController)

module.exports = router;