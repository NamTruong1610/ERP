import * as checkoutSessionService from '../lib/stripe/checkoutSession.service.js';

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

export const createPaymentAttemptController = async (req, res) => {
  const result = await checkoutSessionService.createCheckoutSessionService(req.body, actorFrom(req));
  return res.status(200).json({ data: result });
};

export const cancelPaymentAttemptController = async (req, res) => {
  const result = await paymentAttemptService.cancelPaymentAttemptService(req.params.attemptId, actorFrom(req));
  return res.status(200).json({ data: result });
};