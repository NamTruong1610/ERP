const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middlewares/authMiddleware')
const { requirePermission } = require('../middlewares/rbacMiddleware')
const { PERMISSIONS } = require('../config/RBACConfig')
const {
  getAllPatientsController,
  getPatientController,
  createPatientController,
  updatePatientController,
  deletePatientController
} = require('../controllers/patientControllers')
 
router.get('/', requireAuth, requirePermission(PERMISSIONS.PATIENTS_READ), getAllPatientsController)
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.PATIENTS_READ), getPatientController)
router.post('/', requireAuth, requirePermission(PERMISSIONS.PATIENTS_CREATE), createPatientController)
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.PATIENTS_UPDATE), updatePatientController)
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.PATIENTS_DELETE), deletePatientController)
 
module.exports = router