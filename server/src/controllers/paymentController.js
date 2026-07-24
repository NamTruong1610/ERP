const {
  createPaymentService, getInvoicePaymentLedgerService, voidPaymentService,
} = require('../services/paymentService'); // FIXED: was '../services/paymentService' (singular, wrong path)

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

exports.createPaymentController = async (req, res, next) => {
  const paymentRecord = await createPaymentService(req.body, actorFrom(req));
  return res.status(200).json({ data: paymentRecord });
};

exports.getInvoicePaymentLedgerController = async (req, res, next) => {
  const ledger = await getInvoicePaymentLedgerService(req.params.invoiceId);
  return res.status(200).json({ data: ledger });
};

exports.voidPaymentController = async (req, res, next) => {
  const result = await voidPaymentService(req.params.paymentId, req.body.reason, actorFrom(req));
  return res.status(200).json({ data: result });
};