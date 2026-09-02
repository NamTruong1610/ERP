import * as invoiceRepository from '../repositories/invoice.repository.js';
import * as invoiceItemRepository from '../repositories/invoiceItem.repository.js';
import * as treatmentRepository from '../repositories/treatment.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { AuditAction, TargetType, InvoiceStatus } from '@prisma/client';

const resolveTreatmentLinkedItem = async (invoiceRecord, treatmentId, description, amount) => {
  const [treatment] = await treatmentRepository.findTreatmentsByIds([treatmentId]);
  if (!treatment) throw new appError.AppError('Treatment not found', 404);
  if (treatment.visit.patientId !== invoiceRecord.patientId) {
    throw new appError.AppError("Treatment does not belong to this invoice's patient", 400);
  }
  if (treatment.invoiceItem != null) {
    throw new appError.AppError('Treatment has already been invoiced', 400);
  }

  return {
    treatmentId: treatment.id,
    description: description?.trim() || treatment.procedure,
    amount: amount !== undefined ? parseFloat(amount) : treatment.amount,
  };
};

export const createInvoiceItemService = async (invoiceId, { treatmentId, description, amount }, actor) => {
  const invoiceRecord = await invoiceRepository.findInvoiceById(invoiceId);
  if (!invoiceRecord) throw new appError.AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new appError.AppError('Invoice is no longer a draft and cannot be edited', 409);
  }

  let itemData;
  if (treatmentId) {
    itemData = await resolveTreatmentLinkedItem(invoiceRecord, treatmentId, description, amount);
  } else {
    if (!description?.trim()) throw new appError.AppError('Description is required', 400);
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new appError.AppError('A valid amount is required', 400);
    }
    itemData = { treatmentId: null, description: description.trim(), amount: parsedAmount };
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const item = await invoiceItemRepository.createInvoiceItem(invoiceId, itemData, tx);

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: invoiceId,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_ITEM_ADDED,
      metadata: { itemId: item.id, treatmentId: itemData.treatmentId, amount: itemData.amount },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return invoiceRepository.recomputeInvoiceTotals(invoiceId, tx);
  });
};

export const updateInvoiceItemService = async (invoiceId, itemId, { treatmentId, description, amount }, actor) => {
  const itemRecord = await invoiceItemRepository.findInvoiceItemById(itemId);
  if (!itemRecord || itemRecord.invoiceId !== invoiceId) {
    throw new appError.AppError('Invoice item not found', 404);
  }
  if (itemRecord.invoice.status !== InvoiceStatus.DRAFT) {
    throw new appError.AppError('Invoice is no longer a draft and cannot be edited', 409);
  }

  let itemData;
  if (treatmentId && treatmentId !== itemRecord.treatmentId) {
    // Linking to a new/different treatment
    itemData = await resolveTreatmentLinkedItem(itemRecord.invoice, treatmentId, description, amount);
  } else {
    // Either no treatment change, or explicitly unlinking (treatmentId === null)
    const parsedAmount = amount !== undefined ? parseFloat(amount) : undefined;
    if (parsedAmount !== undefined && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      throw new appError.AppError('A valid amount is required', 400);
    }
    if (description !== undefined && !description?.trim()) {
      throw new appError.AppError('Description is required', 400);
    }
    itemData = {
      description: description?.trim(),
      amount: parsedAmount,
      ...(treatmentId === null && { treatmentId: null }),
    };
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    await invoiceItemRepository.updateInvoiceItem(itemId, itemData, tx);

    await auditRepository.createAuditLog({
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

    return invoiceRepository.recomputeInvoiceTotals(invoiceId, tx);
  });
};

export const deleteInvoiceItemService = async (invoiceId, itemId, actor) => {
  const itemRecord = await invoiceItemRepository.findInvoiceItemById(itemId);
  if (!itemRecord || itemRecord.invoiceId !== invoiceId) {
    throw new appError.AppError('Invoice item not found', 404);
  }
  if (itemRecord.invoice.status !== InvoiceStatus.DRAFT) {
    throw new appError.AppError('Invoice is no longer a draft and cannot be edited', 409);
  }

  const invoiceRecord = await invoiceRepository.findInvoiceById(invoiceId);
  if (invoiceRecord.items.length <= 1) {
    throw new appError.AppError('Invoice must have at least one item', 400);
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    await invoiceItemRepository.deleteInvoiceItem(itemId, tx);

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: invoiceId,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_ITEM_REMOVED,
      metadata: { item: itemRecord },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return invoiceRepository.recomputeInvoiceTotals(invoiceId, tx);
  });
};