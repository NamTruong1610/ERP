import * as prismaConfig from '../config/prisma.config.js';
import { InvoiceItemStatus } from '@prisma/client';
export const findInvoiceItemById = async (id, client = prismaConfig.prisma) => {
  return await client.invoiceItem.findUnique({
    where: { id },
    include: {
      invoice: true,    // needed to check invoice status and patientId
      treatment: true   // needed for response
    }
  })
}

// Lean variant — no joins. Used inside hot loops (payment/void processing)
// that only need paidAmount/amount/itemStatus, not the full invoice+treatment.
export const findInvoiceItemByIdLean = async (id, client = prismaConfig.prisma) => {
  return await client.invoiceItem.findUnique({
    where: { id }
  })
}

export const findInvoiceItemsByIds = async (ids, client = prismaConfig.prisma) => {
  return client.invoiceItem.findMany({
    where: { id: { in: ids } },
  })
}

export const findUnpaidInvoiceItemsByIds = async (ids, client = prismaConfig.prisma) => {
  return await client.invoiceItem.findMany({
    where: {
      id: { in: ids },
      OR: [
        { itemStatus: InvoiceItemStatus.UNPAID },
        { itemStatus: InvoiceItemStatus.PARTIALLY_PAID }
      ]
    },
    include: {
      invoice: true,    // needed to check invoice status and patientId
      treatment: true   // needed for response
    }
  })
}

export const findInvoiceItemsByInvoiceId = async (invoiceId, client = prismaConfig.prisma) => {
  return await client.invoiceItem.findMany({
    where: { invoiceId }
  })
}

// Add a single item to an existing draft invoice.
export const createInvoiceItem = async (invoiceId, itemData, client = prismaConfig.prisma) => {
  return await client.invoiceItem.create({
    data: {
      invoiceId,
      treatmentId: itemData.treatmentId ?? null,
      description: itemData.description,
      amount: parseFloat(itemData.amount)
    }
  })
}

// Update a single item on a draft invoice.
// Only updates fields that are actually provided.
export const updateInvoiceItem = async (id, itemData, client = prismaConfig.prisma) => {
  return await client.invoiceItem.update({
    where: { id },
    data: {
      ...(itemData.description !== undefined && { description: itemData.description }),
      ...(itemData.amount !== undefined && { amount: parseFloat(itemData.amount) }),
      ...(itemData.treatmentId !== undefined && { treatmentId: itemData.treatmentId ?? null }),
    }
  })
}

// Used by createPayment/voidPayment flows to update paidAmount + itemStatus
// together in a single round trip.
export const updateInvoiceItemPaidAmountAndStatus = async (id, paidAmount, itemStatus, client = prismaConfig.prisma) => {
  return await client.invoiceItem.update({
    where: { id },
    data: { paidAmount, itemStatus },
  })
}

// Remove a single item from a draft invoice. Line items are ephemeral
// drafting detail (the Invoice itself carries the audit trail), so this is
// a hard delete rather than a soft delete.
export const deleteInvoiceItem = async (id, client = prismaConfig.prisma) => {
  return await client.invoiceItem.delete({
    where: { id }
  })
}