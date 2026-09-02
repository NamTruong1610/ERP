import * as prismaConfig from '../config/prisma.config.js';
import { InvoiceItemStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';
// Must be called with `client` set to an active transaction (tx) — the
// caller (paymentService) owns the transaction so the audit log write can
// be committed atomically with the payment itself.
export const createPayment = async (data, itemPayments, client) => {
  const itemPaymentsArray = [...itemPayments.entries()];
  const totalAmount = itemPaymentsArray.reduce((sum, [, amount]) => sum + amount, 0);

  // amount is required on Payment with no default — it must be provided
  // up front rather than created empty and patched in afterward.
  const payment = await client.payment.create({
    data: { ...data, amount: totalAmount }, // invoiceId, method, note, recordedById, amount
  });

  const itemPaymentsData = itemPaymentsArray.map(([invoiceItemId, amount]) => ({
    paymentId: payment.id,
    invoiceItemId,
    amount,
  }));

  await client.paymentAllocation.createMany({
    data: itemPaymentsData,
  });

  // Update each paid invoice item's paidAmount + itemStatus in a single round trip
  for (const [invoiceItemId, amount] of itemPaymentsArray) {
    const item = await client.invoiceItem.findUnique({
      where: { id: invoiceItemId },
    });

    const newPaidAmount = item.paidAmount + amount;

    await client.invoiceItem.update({
      where: { id: invoiceItemId },
      data: {
        paidAmount: newPaidAmount,
        // Overpayment is capped by the service layer before this runs.
        itemStatus: newPaidAmount >= item.amount
          ? InvoiceItemStatus.PAID
          : InvoiceItemStatus.PARTIALLY_PAID,
      },
    });
  }

  // Recompute invoice-level status from all its items
  const allItems = await client.invoiceItem.findMany({
    where: { invoiceId: data.invoiceId },
  });

  const allPaid = allItems.every(i => i.itemStatus === InvoiceItemStatus.PAID);
  const nonePaid = allItems.every(i => i.paidAmount === 0);

  const invoiceStatus = allPaid
    ? InvoiceStatus.PAID
    : nonePaid
      ? undefined
      : InvoiceStatus.PARTIALLY_PAID;

  const updatedInvoice = await client.invoice.update({
    where: { id: data.invoiceId },
    data: {
      paidAmount: { increment: totalAmount },
      ...(invoiceStatus ? { status: invoiceStatus } : {}),
    },
  });

  return { payment, invoice: updatedInvoice };
};

export const findPaymentById = async (paymentId, client = prismaConfig.prisma) => {
  return await client.payment.findFirst({
    where: { id: paymentId },
    include: { allocations: true }
  })
}

export const markPaymentVoided = (paymentId, { voidedById, reason }, client = prismaConfig.prisma) =>
  client.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.VOIDED,
      voidedById,
      voidedAt: new Date(),
      voidReason: reason ?? null,
    },
  });