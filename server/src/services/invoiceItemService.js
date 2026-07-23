const { findInvoiceById, recomputeInvoiceTotals } = require('../repositories/invoiceRepository');
const { createInvoiceItem, updateInvoiceItem, deleteInvoiceItem, findInvoiceItemById } = require('../repositories/invoiceItemRepository');
const { findTreatmentsByIds } = require('../repositories/treatmentRepository');
const { createAuditLog } = require('../repositories/auditRepository');
const { prisma } = require('../config/PrismaConfig');
const { AppError } = require('../utils/errorsUtil.js');
const { AuditAction, TargetType, InvoiceStatus } = require('@prisma/client');

const resolveTreatmentLinkedItem = async (invoiceRecord, treatmentId, description, amount) => {
  const [treatment] = await findTreatmentsByIds([treatmentId]);
  if (!treatment) throw new AppError('Treatment not found', 404);
  if (treatment.appointment.patientId !== invoiceRecord.patientId) {
    throw new AppError("Treatment does not belong to this invoice's patient", 400);
  }
  if (treatment.invoiceItem != null) {
    throw new AppError('Treatment has already been invoiced', 400);
  }

  return {
    treatmentId: treatment.id,
    description: description?.trim() || treatment.procedure,
    amount: amount !== undefined ? parseFloat(amount) : treatment.amount,
  };
};

exports.createInvoiceItemService = async (invoiceId, { treatmentId, description, amount }, actor) => {
  const invoiceRecord = await findInvoiceById(invoiceId);
  if (!invoiceRecord) throw new AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Invoice is no longer a draft and cannot be edited', 409);
  }

  let itemData;
  if (treatmentId) {
    itemData = await resolveTreatmentLinkedItem(invoiceRecord, treatmentId, description, amount);
  } else {
    if (!description?.trim()) throw new AppError('Description is required', 400);
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('A valid amount is required', 400);
    }
    itemData = { treatmentId: null, description: description.trim(), amount: parsedAmount };
  }

  return prisma.$transaction(async (tx) => {
    const item = await createInvoiceItem(invoiceId, itemData, tx);

    await createAuditLog({
      actorId: actor.id,
      targetId: invoiceId,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_ITEM_ADDED,
      metadata: { itemId: item.id, treatmentId: itemData.treatmentId, amount: itemData.amount },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return recomputeInvoiceTotals(invoiceId, tx);
  });
};

exports.updateInvoiceItemService = async (invoiceId, itemId, { treatmentId, description, amount }, actor) => {
  const itemRecord = await findInvoiceItemById(itemId);
  if (!itemRecord || itemRecord.invoiceId !== invoiceId) {
    throw new AppError('Invoice item not found', 404);
  }
  if (itemRecord.invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Invoice is no longer a draft and cannot be edited', 409);
  }

  let itemData;
  if (treatmentId && treatmentId !== itemRecord.treatmentId) {
    // Linking to a new/different treatment
    itemData = await resolveTreatmentLinkedItem(itemRecord.invoice, treatmentId, description, amount);
  } else {
    // Either no treatment change, or explicitly unlinking (treatmentId === null)
    const parsedAmount = amount !== undefined ? parseFloat(amount) : undefined;
    if (parsedAmount !== undefined && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      throw new AppError('A valid amount is required', 400);
    }
    if (description !== undefined && !description?.trim()) {
      throw new AppError('Description is required', 400);
    }
    itemData = {
      description: description?.trim(),
      amount: parsedAmount,
      ...(treatmentId === null && { treatmentId: null }),
    };
  }

  return prisma.$transaction(async (tx) => {
    await updateInvoiceItem(itemId, itemData, tx);

    await createAuditLog({
      actorId: actor.id,
      targetId: invoiceId,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_ITEM_UPDATED,
      metadata: {
        itemId,
        fields: [
          treatmentId !== undefined && 'treatmentId',
          description !== undefined && 'description',
          amount !== undefined && 'amount',
        ].filter(Boolean),
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return recomputeInvoiceTotals(invoiceId, tx);
  });
};

exports.deleteInvoiceItemService = async (invoiceId, itemId, actor) => {
  const itemRecord = await findInvoiceItemById(itemId);
  if (!itemRecord || itemRecord.invoiceId !== invoiceId) {
    throw new AppError('Invoice item not found', 404);
  }
  if (itemRecord.invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Invoice is no longer a draft and cannot be edited', 409);
  }

  const invoiceRecord = await findInvoiceById(invoiceId);
  if (invoiceRecord.items.length <= 1) {
    throw new AppError('Invoice must have at least one item', 400);
  }

  return prisma.$transaction(async (tx) => {
    await deleteInvoiceItem(itemId, tx);

    await createAuditLog({
      actorId: actor.id,
      targetId: invoiceId,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_ITEM_REMOVED,
      metadata: { item: itemRecord },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return recomputeInvoiceTotals(invoiceId, tx);
  });
};