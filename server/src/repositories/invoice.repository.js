import * as prismaConfig from '../config/prisma.config.js';
import { InvoiceStatus } from '@prisma/client';
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

const generateInvoiceNumber = async () => {
  const sequence = await prismaConfig.prisma.$queryRaw`
  SELECT nextval('invoice_number_seq') as val;
  `
  const num = sequence[0].val.toString().padStart(6, "0")
  const d = new Date();
  const year = d.getFullYear();

  const invoiceNumber = `INV-${year}-${num}`

  return invoiceNumber
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

export const createDraftInvoice = async ({
  patientId,
  dueAt,
  billedToName,
  billedToEmail,
  billedToPhone,
  billedToAddress
}, treatments, client = prismaConfig.prisma) => {
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
export const issueInvoiceById = async (invoiceId, client = prismaConfig.prisma) => {
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

export const updateInvoiceDraft = async (id, data, client = prismaConfig.prisma) => {
  return await client.invoice.update({
    where: { id },
    data,
    include: invoiceInclude
  })
}

export const findInvoiceById = async (invoiceId, client = prismaConfig.prisma) => {
  return await client.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: invoiceInclude
  })
}

export const findAllInvoices = async ({ take = 20, skip = 0, patientId, status } = {}, client = prismaConfig.prisma) => {
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

export const recomputeInvoiceTotals = async (invoiceId, client = prismaConfig.prisma) => {
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

export const voidInvoiceById = async (invoiceId, reason, client = prismaConfig.prisma) => {
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

export const softDeleteDraftInvoice = async (invoiceId, client = prismaConfig.prisma) => {
  return await client.invoice.updateMany({
    where: {
      id: invoiceId,
      status: InvoiceStatus.DRAFT,
      deletedAt: null
    },
    data: { deletedAt: new Date() }
  })
}

// Used by voidPaymentService to reverse a payment's effect on the invoice.
export const updateInvoiceStatusAndPaidAmount = async (invoiceId, { decrementBy, status }, client = prismaConfig.prisma) => {
  return await client.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: { decrement: decrementBy },
      status,
    },
  })
}

export const getInvoicePaymentLedger = async (invoiceId, client = prismaConfig.prisma) => {
  const invoice = await client.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      payments: {
        include: {
          allocations: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!invoice) return null;

  return {
    invoiceId: invoice.id,
    invoiceStatus: invoice.status,
    // FIXED: was invoice.amount, which is never written anywhere — the
    // actual computed total field is `total` (see computeTotals above).
    totalAmount: invoice.total,
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.total - invoice.paidAmount,
    payments: invoice.payments.map(p => ({
      id: p.id,
      method: p.method,
      amount: p.amount,
      note: p.note,
      status: p.status,
      voidedAt: p.voidedAt,
      voidReason: p.voidReason,
      createdAt: p.createdAt,
      allocations: p.allocations.map(a => ({
        invoiceItemId: a.invoiceItemId,
        amount: a.amount,
      })),
    })),
  };
};