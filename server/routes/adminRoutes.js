const express = require("express");
const router = express.Router();
const {
  createUserController,
  deleteUserController,
  getAllUsersController
} = require("../controllers/adminControllers")
router.post("/users", createUserController)
router.delete("/users/:_id", deleteUserController)
router.get("/users", getAllUsersController)


module.exports = router;