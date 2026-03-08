const express = require("express");
const router = express.Router();
const {
  createUserController
} = require("../controllers/adminController")
router.post("/admin/users", createUserController)

