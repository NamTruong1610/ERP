const { prisma } = require('../config/PrismaConfig')
const { findInvoiceItemById } = require('./invoiceItemServices')

exports.createPayment = async (data, itemPayments, client = prisma) => {
  return client.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data // invoiceId, method, note, recordedById
    });

    const itemPaymentsData = [];
    let paidAmount = 0;

    for (const [invoiceItemId, amount] of itemPayments) {
      itemPaymentsData.push({
        paymentId: payment.id,
        invoiceItemId,
        amount,
      });
      paidAmount += amount;
    }

    await tx.paymentAllocation.createMany({
      data: itemPaymentsData,
    });

    // Update each paid invoice item's paidAmount + status in a single round trip
    for (const [invoiceItemId, amount] of itemPayments) {
      const item = await tx.invoiceItem.findUnique({
        where: { id: invoiceItemId },
      });

      const newPaidAmount = item.paidAmount + amount;

      await tx.invoiceItem.update({
        where: { id: invoiceItemId },
        data: {
          paidAmount: newPaidAmount,
          // Overpayment is capped by the controller
          status: newPaidAmount >= item.amount
            ? InvoiceItemStatus.PAID
            : InvoiceItemStatus.PARTIALLY_PAID,
        },
      });
    }

    // Recompute invoice-level status from all its items
    const allItems = await tx.invoiceItem.findMany({
      where: { invoiceId: data.invoiceId },
    });

    const allPaid = allItems.every(i => i.status === InvoiceItemStatus.PAID);
    const nonePaid = allItems.every(i => i.paidAmount === 0);

    const invoiceStatus = allPaid
      ? InvoiceStatus.PAID
      : nonePaid
        ? undefined
        : InvoiceStatus.PARTIALLY_PAID;

    const updatedInvoice = await tx.invoice.update({
      where: { id: data.invoiceId },
      data: {
        paidAmount: { increment: paidAmount },
        ...(invoiceStatus ? { status: invoiceStatus } : {}),
      },
    });

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: { amount: paidAmount },
    });

    return { payment: updatedPayment, invoice: updatedInvoice };
  });
};


exports.findPaymentById = async (paymentId, client = prisma) => {
  return await client.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
  })
}

exports.voidPayment = async (paymentId, voidedById, reason, client = prisma) => {
  return client.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { allocations: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === PaymentStatus.VOIDED) {
      throw new Error('Payment already voided');
    }

    // Reverse each allocation: decrement item paidAmount, recompute status downward
    for (const allocation of payment.allocations) {
      const item = await tx.invoiceItem.findUnique({
        where: { id: allocation.invoiceItemId },
      });

      const newPaidAmount = item.paidAmount - allocation.amount;

      await tx.invoiceItem.update({
        where: { id: allocation.invoiceItemId },
        data: {
          paidAmount: newPaidAmount,
          status: newPaidAmount <= 0
            ? InvoiceItemStatus.UNPAID
            : newPaidAmount < item.amount
              ? InvoiceItemStatus.PARTIALLY_PAID
              : InvoiceItemStatus.PAID,
        },
      });
    }

    // Recompute invoice-level status from all its items
    const allItems = await tx.invoiceItem.findMany({
      where: { invoiceId: payment.invoiceId },
    });

    const allUnpaid = allItems.every(i => i.status === InvoiceItemStatus.UNPAID);
    const allPaid = allItems.every(i => i.status === InvoiceItemStatus.PAID);

    const invoiceStatus = allUnpaid
      ? InvoiceStatus.ISSUED
      : allPaid
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

    const updatedInvoice = await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        paidAmount: { decrement: payment.amount },
        status: invoiceStatus,
      },
    });

    const voidedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.VOIDED,
        voidedById,
        voidedAt: new Date(),
        voidReason: reason ?? null,
      },
    });

    return { payment: voidedPayment, invoice: updatedInvoice };
  });
};