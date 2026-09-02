import express from 'express';
import adminRoutes from './admin.routes.js';
import activationRoutes from './activation.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import patientRoutes from './patient.routes.js';
import appointmentRoutes from './appointment.routes.js';
import treatmentRoutes from './treatment.routes.js';
import treatmentPlanRoutes from './treatmentPlan.routes.js';
import procedureCatalogRoutes from './procedureCatalog.routes.js';
import visitRoutes from './visit.routes.js';
import invoiceRoutes from './invoice.routes.js';
import paymentRoutes from './payment.routes.js';
import paymentAttemptRoutes from './paymentAttempt.routes.js';
import webhookRoutes from './webhook.routes.js';
import systemRoutes from './system.routes.js';
import fileRoutes from './file.routes.js';
import statsRoutes from './stats.routes.js';

const router = express.Router()

router.use('/admin', adminRoutes)
router.use('/activate', activationRoutes)
router.use('/auth', authRoutes)
router.use('/user', userRoutes)
router.use('/patients', patientRoutes)
router.use('/appointments', appointmentRoutes)
router.use('/treatments', treatmentRoutes)
router.use('/treatment-plans', treatmentPlanRoutes)
router.use('/procedures', procedureCatalogRoutes)
router.use('/visits', visitRoutes)
router.use('/invoices', invoiceRoutes)
router.use('/payments', paymentRoutes)
router.use('/payment-attempts', paymentAttemptRoutes)
router.use('/webhooks', webhookRoutes)
router.use('/system', systemRoutes)
router.use('/files', fileRoutes)
router.use('/stats', statsRoutes)

export default router;
