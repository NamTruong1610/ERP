const { prisma } = require('../config/PrismaConfig')
const { generateInvoiceNumber } = require('../utils/invoiceNumberUtils')
const { InvoiceStatus } = require('@prisma/client')

const invoiceInclude = {
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      dob: true,
    }
  },
  items: {
    include: {
      treatment: {
        select: {
          id: true,
          procedure: true,
          amount: true,
          toothNumber: true,
          notes: true,
        }
      }
    }
  }
}

// Subtotal/discount/tax/total are computed server-side from the given line
// amounts and the current TAX/DISCOUNT env rates — never trust client totals.
const computeTotals = (amounts) => {
  const taxRate = parseFloat(process.env.TAX ?? '0')
  const discountRate = parseFloat(process.env.DISCOUNT ?? '0')

  const subtotal = amounts.reduce((sum, amount) => sum + amount, 0)
  const discount = subtotal * discountRate
  const tax = (subtotal - discount) * taxRate
  const total = subtotal - discount + tax

  return { subtotal, discount, tax, total }
}

exports.createDraftInvoice = async ({
  patientId,
  dueAt,
  billedToName,
  billedToEmail,
  billedToPhone,
  billedToAddress
}, treatments, client = prisma) => {
  const totals = computeTotals(treatments.map(t => t.amount))

  return await client.invoice.create({
    data: {
      patientId,
      ...totals,
      dueAt: dueAt ? new Date(dueAt) : null,
      billedToName,
      billedToEmail,
      billedToPhone,
      billedToAddress,
      items: {
        create: treatments.map(t => ({
          treatmentId: t.id,
          description: t.procedure,
          amount: t.amount
        }))
      }
    },
    include: invoiceInclude
  })
}

// Returns { count } — 1 if the invoice was DRAFT and got issued, 0 if it was
// already issued/missing/deleted by the time this ran (caller decides 404 vs 409).
exports.issueInvoiceById = async (invoiceId, client = prisma) => {
  const invoiceNumber = await generateInvoiceNumber()
  return await client.invoice.updateMany({
    where: {
      id: invoiceId,
      status: InvoiceStatus.DRAFT,
      deletedAt: null
    },
    data: {
      invoiceNumber,
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date()
    }
  })
}

exports.updateInvoiceDraft = async (id, data, client = prisma) => {
  return await client.invoice.update({
    where: { id },
    data,
    include: invoiceInclude
  })
}

exports.findInvoiceById = async (invoiceId, client = prisma) => {
  return await client.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: invoiceInclude
  })
}

exports.findAllInvoices = async ({ take = 20, skip = 0, patientId, status } = {}, client = prisma) => {
  const where = {
    deletedAt: null,
    ...(patientId && { patientId }),
    ...(status && { status })
  }

  const [invoices, total] = await Promise.all([
    client.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    client.invoice.count({ where })
  ])

  return { invoices, total, take, skip }
}

exports.recomputeInvoiceTotals = async (invoiceId, client = prisma) => {
  const items = await client.invoiceItem.findMany({
    where: { invoiceId }
  })

  const totals = computeTotals(items.map(item => item.amount))

  return await client.invoice.update({
    where: { id: invoiceId },
    data: totals,
    include: invoiceInclude
  })
}

exports.voidInvoiceById = async (invoiceId, reason, client = prisma) => {
  return await client.invoice.updateMany({
    where: {
      id: invoiceId,
      status: InvoiceStatus.ISSUED,
      deletedAt: null
    },
    data: {
      status: InvoiceStatus.VOIDED,
      voidedAt: new Date(),
      voidReason: reason ?? null
    }
  })
}

exports.softDeleteDraftInvoice = async (invoiceId, client = prisma) => {
  return await client.invoice.updateMany({
    where: {
      id: invoiceId,
      status: InvoiceStatus.DRAFT,
      deletedAt: null
    },
    data: { deletedAt: new Date() }
  })
}