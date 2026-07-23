const {
  createPaymentService, getInvoicePaymentLedgerService, voidPaymentService,
} = require('../services/paymentService'); // FIXED: was '../services/paymentService' (singular, wrong path)
const { AppError } = require('../utils/errorsUtil.js');

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });
const handle = (res, next, error) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
  next(error);
};

exports.createPaymentController = async (req, res, next) => {
  try {
    const paymentRecord = await createPaymentService(req.body, actorFrom(req));
    return res.status(200).json({ data: paymentRecord });
  } catch (error) { handle(res, next, error); }
};

exports.getInvoicePaymentLedgerController = async (req, res, next) => {
  try {
    const ledger = await getInvoicePaymentLedgerService(req.params.invoiceId);
    return res.status(200).json({ data: ledger });
  } catch (error) { handle(res, next, error); }
};

exports.voidPaymentController = async (req, res, next) => {
  try {
    const result = await voidPaymentService(req.params.paymentId, req.body.reason, actorFrom(req));
    return res.status(200).json({ data: result });
  } catch (error) { handle(res, next, error); }
};