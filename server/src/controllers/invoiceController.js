const {
  getAllInvoicesService, getInvoiceService, createInvoiceService,
  updateInvoiceService, issueInvoiceService, voidInvoiceService, deleteInvoiceService,
} = require('../services/invoiceService');

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

exports.getAllInvoicesController = async (req, res, next) => {
  const result = await getAllInvoicesService(req.query);
  return res.status(200).json(result);
};

exports.getInvoiceController = async (req, res, next) => {
  const invoice = await getInvoiceService(req.params.id);
  return res.status(200).json({ invoice });
};

exports.createInvoiceController = async (req, res, next) => {
  const invoice = await createInvoiceService(req.body, actorFrom(req));
  return res.status(201).json({ invoice });
};

exports.updateInvoiceController = async (req, res, next) => {
  const invoice = await updateInvoiceService(req.params.id, req.body, actorFrom(req));
  return res.status(200).json({ invoice });
};

exports.issueInvoiceController = async (req, res, next) => {
  const invoice = await issueInvoiceService(req.params.id, actorFrom(req));
  return res.status(200).json({ invoice });
};

exports.voidInvoiceController = async (req, res, next) => {
  const invoice = await voidInvoiceService(req.params.id, req.body.reason, actorFrom(req));
  return res.status(200).json({ invoice });
};

exports.deleteInvoiceController = async (req, res, next) => {
  await deleteInvoiceService(req.params.id, actorFrom(req));
  return res.status(204).send();
};