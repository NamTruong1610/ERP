import * as invoiceService from '../services/invoice.service.js';

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

export const getAllInvoicesController = async (req, res, next) => {
  const result = await invoiceService.getAllInvoicesService(req.query);
  return res.status(200).json(result);
};

export const getInvoiceController = async (req, res, next) => {
  const invoice = await invoiceService.getInvoiceService(req.params.id);
  return res.status(200).json({ invoice });
};

export const createInvoiceController = async (req, res, next) => {
  const invoice = await invoiceService.createInvoiceService(req.body, actorFrom(req));
  return res.status(201).json({ invoice });
};

export const updateInvoiceController = async (req, res, next) => {
  const invoice = await invoiceService.updateInvoiceService(req.params.id, req.body, actorFrom(req));
  return res.status(200).json({ invoice });
};

export const issueInvoiceController = async (req, res, next) => {
  const invoice = await invoiceService.issueInvoiceService(req.params.id, actorFrom(req));
  return res.status(200).json({ invoice });
};

export const voidInvoiceController = async (req, res, next) => {
  const invoice = await invoiceService.voidInvoiceService(req.params.id, req.body.reason, actorFrom(req));
  return res.status(200).json({ invoice });
};

export const deleteInvoiceController = async (req, res, next) => {
  await invoiceService.deleteInvoiceService(req.params.id, actorFrom(req));
  return res.status(204).send();
};