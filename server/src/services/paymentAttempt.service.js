import * as invoiceRepository from '../repositories/invoice.repository.js';

import * as invoiceItemRepository from '../repositories/invoiceItem.repository.js';

import * as paymentAttemptRepository from '../repositories/paymentAttempt.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';

import * as tokenUtils from '../utils/token.utils.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { InvoiceStatus, TargetType, AuditAction } from '@prisma/client';
import { randomUUID } from 'crypto';

export const createPaymentAttemptService = async ({ invoiceId, itemPayments: rawItemPayments }, actor) => {
  const invoiceRecord = await invoiceRepository.findInvoiceById(invoiceId);
  if (!invoiceRecord || ![InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE].includes(invoiceRecord.status)) {
    throw new appError.AppError('No eligible invoices for payment', 404);
  }

  const itemPayments = new Map(rawItemPayments);
  const invoiceItems = await invoiceItemRepository.findUnpaidInvoiceItemsByIds([...itemPayments.keys()]);

  if (invoiceItems.length === 0) {
    throw new appError.AppError('No pending payment for any invoices', 400);
  }
  if (invoiceItems.length !== itemPayments.size) {
    throw new appError.AppError('One or more invoice items not eligible for payment', 400);
  }

  for (const item of invoiceItems) {
    // Guard against items from a different invoice being paid against this one —
    // invoiceItemRepository.findUnpaidInvoiceItemsByIds only filters by id/status, not invoiceId.
    if (item.invoiceId !== invoiceId) {
      throw new appError.AppError('One or more invoice items do not belong to this invoice', 400);
    }
    if (itemPayments.get(item.id) > item.amount - item.paidAmount) {
      throw new appError.AppError('Payment amount exceeds one or more items required amount', 400);
    }
  }

  const idempotencyKey = randomUUID()

  return prismaConfig.prisma.$transaction(async (tx) => {
    const result = await paymentAttemptRepository.createPaymentAttempt({
      invoiceId: invoiceRecord.id,
      createdById: actor.id,
      idempotencyKey
    }, [...itemPayments.entries()], tx);

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: result.id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_PAYMENT_ATTEMPTED,
      metadata: {
        invoiceId,
        itemPayments: [...itemPayments.entries()],
        idempotencyKey
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    // createPayment's own invoice update has no include — fetch the fully
    // populated invoice here so the caller can use this response directly
    // instead of needing a separate GET.
    return { paymentAttempt: result, invoice: await invoiceRepository.findInvoiceById(invoiceId, tx) };
  });
}