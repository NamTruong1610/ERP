const express = require("express");
const router = express.Router();
const {
  createUserController,
  deleteInactiveUserController
} = require("../controllers/adminController")
router.post("/admin/users", createUserController)
router.delete("/admin/users/:_id", deleteInactiveUserController)


module.exports = router;