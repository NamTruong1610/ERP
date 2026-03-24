const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware")
const {
  getProfileController,
  updateNameController,
  updatePhonesController,
  removePhoneController,
  addAddressController,
  updateAddressController,
  removeAddressController,
  changePasswordController,
  changeEmailController,
  verifyEmailChangeController 
} = require("../controllers/userControllers")

router.get("/profile", requireAuth, getProfileController)
router.post("/name", requireAuth, updateNameController)

// Phones
router.post('/phones', requireAuth, updatePhonesController)
router.delete('/phones/:phone', requireAuth, removePhoneController)

// Addresses
router.post('/addresses', requireAuth, addAddressController)
router.patch('/addresses/:addressId', requireAuth, updateAddressController)
router.delete('/addresses/:addressId', requireAuth, removeAddressController)

// Password
router.post('/password', requireAuth, changePasswordController)

// Email
router.post('/email', requireAuth, changeEmailController)
router.post('/email/verify', requireAuth, verifyEmailChangeController )


module.exports = router;