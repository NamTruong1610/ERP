import * as paymentService from '../services/payment.service.js';

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

export const createPaymentController = async (req, res) => {
  const paymentRecord = await paymentService.createPaymentService(req.body, actorFrom(req));
  return res.status(201).json({ data: paymentRecord });
};

export const getInvoicePaymentLedgerController = async (req, res) => {
  const ledger = await paymentService.getInvoicePaymentLedgerService(req.params.invoiceId);
  return res.status(200).json({ data: ledger });
};

export const voidPaymentController = async (req, res) => {
  const result = await paymentService.voidPaymentService(req.params.paymentId, req.body.reason, actorFrom(req));
  return res.status(200).json({ data: result });
};