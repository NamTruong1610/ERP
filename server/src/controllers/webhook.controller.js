import * as stripeConfig from '../config/stripe.config.js';
import * as webhookService from '../services/webhook.service.js';
export const handleStripeWebhookController = async (req, res) => {
  let event
  try {
    const signature = req.headers['stripeConfig.stripe-signature']
    event = stripeConfig.stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    // Signature invalid or malformed — reject before touching the DB/queue at all.
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`)
  }

  await webhookService.handleStripeWebhookService(event)

  return res.status(200).json({ received: true })
}