import * as invoiceItemService from '../services/invoiceItem.service.js';

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

export const createInvoiceItemController = async (req, res, next) => {
    const invoice = await invoiceItemService.createInvoiceItemService(req.params.id, req.body, actorFrom(req));
    return res.status(201).json({ invoice });
};

export const updateInvoiceItemController = async (req, res, next) => {
    const invoice = await invoiceItemService.updateInvoiceItemService(req.params.id, req.params.itemId, req.body, actorFrom(req));
    return res.status(200).json({ invoice });
};

export const deleteInvoiceItemController = async (req, res, next) => {
    const invoice = await invoiceItemService.deleteInvoiceItemService(req.params.id, req.params.itemId, actorFrom(req));
    return res.status(200).json({ invoice });
};