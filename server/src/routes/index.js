const express = require('express')
const router = express.Router()

router.use('/admin', require('./adminRoutes'))
router.use('/activate', require('./activationRoutes'))
router.use('/auth', require('./authRoutes'))
router.use('/user', require('./userRoutes'))
router.use('/patients', require('./patientRoutes'))
router.use('/appointments', require('./appointmentRoutes'))
router.use('/treatments', require('./treatmentRoutes'))
router.use('/invoices', require('./invoiceRoutes'))
router.use('/payments', require('./paymentRoutes'))
router.use('/system', require('./systemRoutes'))
router.use('/files', require('./fileRoutes'))
router.use('/stats', require('./statsRoutes'))

module.exports = router