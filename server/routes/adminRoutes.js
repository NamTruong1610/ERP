const express = require("express");
const router = express.Router();
const {
  createUserController,
  deleteUserController
} = require("../controllers/adminControllers")
router.post("/users", createUserController)
router.delete("/users/:_id", deleteUserController)



module.exports = router;