const express = require("express");
const router = express.Router();
const {
  setPasswordController,
  get2faSecretController,
  verify2faSecretSetupController
} = require("../controllers/userControllers")

router.post("/password", setPasswordController)
router.post("/mfa/secret", get2faSecretController)
router.post("/mfa/verify", verify2faSecretSetupController)

module.exports = router;