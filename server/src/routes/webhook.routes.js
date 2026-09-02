import express from 'express';
const router = express.Router()
import * as webhookController from '../controllers/webhook.controller.js';
// express.raw is required here — Stripe signature verification needs the
// exact raw request bytes, not a JSON-parsed body. Also mounted outside
// requireAuth entirely: Stripe is not an authenticated staff user.
router.post('/stripe', express.raw({ type: 'application/json' }), webhookController.handleStripeWebhookController)

export default router;