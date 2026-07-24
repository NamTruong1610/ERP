// controllers/invoiceController.js
const {
  getAllInvoicesService, getInvoiceService, createInvoiceService,
  updateInvoiceService, issueInvoiceService, voidInvoiceService, deleteInvoiceService,
} = require('../services/invoiceService');
const { AppError } = require('../lib/AppError');

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });
const handle = (res, next, error) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
  next(error);
};

exports.getAllInvoicesController = async (req, res, next) => {
  try {
    const result = await getAllInvoicesService(req.query);
    return res.status(200).json(result);
  } catch (error) { handle(res, next, error); }
};

exports.getInvoiceController = async (req, res, next) => {
  try {
    const invoice = await getInvoiceService(req.params.id);
    return res.status(200).json({ invoice });
  } catch (error) { handle(res, next, error); }
};

exports.createInvoiceController = async (req, res, next) => {
  try {
    const invoice = await createInvoiceService(req.body, actorFrom(req));
    return res.status(201).json({ invoice });
  } catch (error) { handle(res, next, error); }
};

exports.updateInvoiceController = async (req, res, next) => {
  try {
    const invoice = await updateInvoiceService(req.params.id, req.body, actorFrom(req));
    return res.status(200).json({ invoice });
  } catch (error) { handle(res, next, error); }
};

exports.issueInvoiceController = async (req, res, next) => {
  try {
    const invoice = await issueInvoiceService(req.params.id, actorFrom(req));
    return res.status(200).json({ invoice });
  } catch (error) { handle(res, next, error); }
};

exports.voidInvoiceController = async (req, res, next) => {
  try {
    const invoice = await voidInvoiceService(req.params.id, req.body.reason, actorFrom(req));
    return res.status(200).json({ invoice });
  } catch (error) { handle(res, next, error); }
};

exports.deleteInvoiceController = async (req, res, next) => {
  try {
    await deleteInvoiceService(req.params.id, actorFrom(req));
    return res.status(204).send();
  } catch (error) { handle(res, next, error); }
};