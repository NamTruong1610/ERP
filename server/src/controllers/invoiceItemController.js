const {
  createInvoiceItemService, updateInvoiceItemService, deleteInvoiceItemService,
} = require('../services/invoiceItemService');
const { AppError } = require('../utils/errorsUtil.js');

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });
const handle = (res, next, error) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
  next(error);
};

exports.createInvoiceItemController = async (req, res, next) => {
  try {
    const invoice = await createInvoiceItemService(req.params.id, req.body, actorFrom(req));
    return res.status(201).json({ invoice });
  } catch (error) { handle(res, next, error); }
};

exports.updateInvoiceItemController = async (req, res, next) => {
  try {
    const invoice = await updateInvoiceItemService(req.params.id, req.params.itemId, req.body, actorFrom(req));
    return res.status(200).json({ invoice });
  } catch (error) { handle(res, next, error); }
};

exports.deleteInvoiceItemController = async (req, res, next) => {
  try {
    const invoice = await deleteInvoiceItemService(req.params.id, req.params.itemId, actorFrom(req));
    return res.status(200).json({ invoice });
  } catch (error) { handle(res, next, error); }
};