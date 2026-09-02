import * as invoiceRepository from '../repositories/invoice.repository.js';
import * as invoiceItemRepository from '../repositories/invoiceItem.repository.js';
import * as paymentRepository from '../repositories/payment.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { TargetType, InvoiceStatus, AuditAction, PaymentStatus, InvoiceItemStatus } from '@prisma/client';

// itemPayments: [invoice item id -> amount] map
export const createPaymentService = async ({ invoiceId, method, note, itemPayments: rawItemPayments }, actor) => {
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

  return prismaConfig.prisma.$transaction(async (tx) => {
    const result = await paymentRepository.createPayment({
      invoiceId: invoiceRecord.id,
      method,
      recordedById: actor.id,
      note: note ?? null,
    }, itemPayments, tx);

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: result.payment.id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_PAYMENT_RECORDED,
      metadata: {
        invoiceId,
        amount: result.payment.amount,
        method,
        itemPayments: [...itemPayments.entries()],
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    // paymentRepository.createPayment's own invoice update has no include — fetch the fully
    // populated invoice here so the caller can use this response directly
    // instead of needing a separate GET.
    return { payment: result.payment, invoice: await invoiceRepository.findInvoiceById(invoiceId, tx) };
  });
};

export const getInvoicePaymentLedgerService = async (invoiceId) => {
  const ledger = await invoiceRepository.getInvoicePaymentLedger(invoiceId);
  if (!ledger) throw new appError.AppError('Invoice not found', 404);
  return ledger;
};

export const voidPaymentService = async (paymentId, reason, actor) => {
  const payment = await paymentRepository.findPaymentById(paymentId);

  if (!payment) {
    throw new appError.AppError('Payment not found', 404);
  }
  if (payment.status === PaymentStatus.VOIDED) {
    throw new appError.AppError('Payment already voided', 400);
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    // Reverse each allocation: decrement item paidAmount, recompute status downward
    for (const allocation of payment.allocations) {
      const item = await invoiceItemRepository.findInvoiceItemByIdLean(allocation.invoiceItemId, tx);
      const newPaidAmount = item.paidAmount - allocation.amount;

      const newStatus = newPaidAmount <= 0
        ? InvoiceItemStatus.UNPAID
        : newPaidAmount < item.amount
          ? InvoiceItemStatus.PARTIALLY_PAID
          : InvoiceItemStatus.PAID;

      await invoiceItemRepository.updateInvoiceItemPaidAmountAndStatus(allocation.invoiceItemId, newPaidAmount, newStatus, tx);
    }

    // Recompute invoice-level status from all its items
    const allItems = await invoiceItemRepository.findInvoiceItemsByInvoiceId(payment.invoiceId, tx);
    const allUnpaid = allItems.every(i => i.itemStatus === InvoiceItemStatus.UNPAID);
    const allPaid = allItems.every(i => i.itemStatus === InvoiceItemStatus.PAID);

    const invoiceStatus = allUnpaid
      ? InvoiceStatus.ISSUED
      : allPaid
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

    const updatedInvoice = await invoiceRepository.updateInvoiceStatusAndPaidAmount(
      payment.invoiceId,
      { decrementBy: payment.amount, status: invoiceStatus },
      tx
    );

    const voidedPayment = await paymentRepository.markPaymentVoided(paymentId, { voidedById: actor.id, reason }, tx);

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: paymentId,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_PAYMENT_VOIDED,
      metadata: { invoiceId: payment.invoiceId, amount: payment.amount, reason },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    // Same reasoning as createPaymentService — return the fully populated
    // invoice so the caller doesn't need a separate fetch.
    return { payment: voidedPayment, invoice: await invoiceRepository.findInvoiceById(payment.invoiceId, tx) };
  });
};