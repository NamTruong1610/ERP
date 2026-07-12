const { prisma } = require('../config/PrismaConfig')

exports.findInvoiceItemById = async (id, client = prisma) => {
  return await client.invoiceItem.findUnique({
    where: { id },
    include: {
      invoice: true,    // needed to check invoice status and patientId
      treatment: true   // needed for response
    }
  })
}

// Add a single item to an existing draft invoice.
exports.createInvoiceItem = async (invoiceId, itemData, client = prisma) => {
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
exports.updateInvoiceItem = async (id, itemData, client = prisma) => {
  return await client.invoiceItem.update({
    where: { id },
    data: {
      ...(itemData.description !== undefined && { description: itemData.description }),
      ...(itemData.amount !== undefined && { amount: parseFloat(itemData.amount) }),
      ...(itemData.treatmentId !== undefined && { treatmentId: itemData.treatmentId ?? null }),
    }
  })
}

// Remove a single item from a draft invoice. Line items are ephemeral
// drafting detail (the Invoice itself carries the audit trail), so this is
// a hard delete rather than a soft delete.
exports.deleteInvoiceItem = async (id, client = prisma) => {
  return await client.invoiceItem.delete({
    where: { id }
  })
}
