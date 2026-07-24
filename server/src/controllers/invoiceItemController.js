const {
  createInvoiceItemService, updateInvoiceItemService, deleteInvoiceItemService,
} = require('../services/invoiceItemService');

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

exports.createInvoiceItemController = async (req, res, next) => {
    const invoice = await createInvoiceItemService(req.params.id, req.body, actorFrom(req));
    return res.status(201).json({ invoice });
};

exports.updateInvoiceItemController = async (req, res, next) => {
    const invoice = await updateInvoiceItemService(req.params.id, req.params.itemId, req.body, actorFrom(req));
    return res.status(200).json({ invoice });
};

exports.deleteInvoiceItemController = async (req, res, next) => {
    const invoice = await deleteInvoiceItemService(req.params.id, req.params.itemId, actorFrom(req));
    return res.status(200).json({ invoice });
};