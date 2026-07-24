const { InvoiceStatus, InvoiceItemStatus, PaymentStatus, AuditAction, TargetType } = require('@prisma/client');
const { findInvoiceById, getInvoicePaymentLedger, updateInvoiceStatusAndPaidAmount } = require('../repositories/invoiceRepository');
const {
  findUnpaidInvoiceItemsByIds,
  findInvoiceItemByIdLean,
  updateInvoiceItemPaidAmountAndStatus,
  findInvoiceItemsByInvoiceId,
} = require('../repositories/invoiceItemRepository');
const { createPayment, findPaymentById, markPaymentVoided } = require('../repositories/paymentRepository');
const { createAuditLog } = require('../repositories/auditRepository');
const { prisma } = require('../config/PrismaConfig');
const { AppError } = require('../lib/AppError');

// itemPayments: [invoice item id -> amount] map
exports.createPaymentService = async ({ invoiceId, method, note, itemPayments: rawItemPayments }, actor) => {
  const invoiceRecord = await findInvoiceById(invoiceId);
  if (!invoiceRecord || ![InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE].includes(invoiceRecord.status)) {
    throw new AppError('No eligible invoices for payment', 404);
  }

  if (!Array.isArray(rawItemPayments) || rawItemPayments.length === 0) {
    throw new AppError('At least one item payment is required', 400);
  }

  const itemPayments = new Map(rawItemPayments);
  const invoiceItems = await findUnpaidInvoiceItemsByIds([...itemPayments.keys()]);

  if (invoiceItems.length === 0) {
    throw new AppError('No pending payment for any invoices', 400);
  }
  if (invoiceItems.length !== itemPayments.size) {
    throw new AppError('One or more invoice items not eligible for payment', 400);
  }
  for (const item of invoiceItems) {
    // Guard against items from a different invoice being paid against this one —
    // findUnpaidInvoiceItemsByIds only filters by id/status, not invoiceId.
    if (item.invoiceId !== invoiceId) {
      throw new AppError('One or more invoice items do not belong to this invoice', 400);
    }
    if (itemPayments.get(item.id) > item.amount - item.paidAmount) {
      throw new AppError('Payment amount exceeds one or more items required amount', 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    const result = await createPayment({
      invoiceId: invoiceRecord.id,
      method,
      recordedById: actor.id,
      note: note ?? null,
    }, itemPayments, tx);

    await createAuditLog({
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

    // createPayment's own invoice update has no include — fetch the fully
    // populated invoice here so the caller can use this response directly
    // instead of needing a separate GET.
    return { payment: result.payment, invoice: await findInvoiceById(invoiceId, tx) };
  });
};

exports.getInvoicePaymentLedgerService = async (invoiceId) => {
  const ledger = await getInvoicePaymentLedger(invoiceId);
  if (!ledger) throw new AppError('Invoice not found', 404);
  return ledger;
};

exports.voidPaymentService = async (paymentId, reason, actor) => {
  const payment = await findPaymentById(paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }
  if (payment.status === PaymentStatus.VOIDED) {
    throw new AppError('Payment already voided', 400);
  }

  return prisma.$transaction(async (tx) => {
    // Reverse each allocation: decrement item paidAmount, recompute status downward
    for (const allocation of payment.allocations) {
      const item = await findInvoiceItemByIdLean(allocation.invoiceItemId, tx);
      const newPaidAmount = item.paidAmount - allocation.amount;

      const newStatus = newPaidAmount <= 0
        ? InvoiceItemStatus.UNPAID
        : newPaidAmount < item.amount
          ? InvoiceItemStatus.PARTIALLY_PAID
          : InvoiceItemStatus.PAID;

      await updateInvoiceItemPaidAmountAndStatus(allocation.invoiceItemId, newPaidAmount, newStatus, tx);
    }

    // Recompute invoice-level status from all its items
    const allItems = await findInvoiceItemsByInvoiceId(payment.invoiceId, tx);
    const allUnpaid = allItems.every(i => i.itemStatus === InvoiceItemStatus.UNPAID);
    const allPaid = allItems.every(i => i.itemStatus === InvoiceItemStatus.PAID);

    const invoiceStatus = allUnpaid
      ? InvoiceStatus.ISSUED
      : allPaid
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

    const updatedInvoice = await updateInvoiceStatusAndPaidAmount(
      payment.invoiceId,
      { decrementBy: payment.amount, status: invoiceStatus },
      tx
    );

    const voidedPayment = await markPaymentVoided(paymentId, { voidedById: actor.id, reason }, tx);

    await createAuditLog({
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
    return { payment: voidedPayment, invoice: await findInvoiceById(payment.invoiceId, tx) };
  });
};