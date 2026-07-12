const { findInvoiceById, recomputeInvoiceTotals } = require('../services/invoiceServices')
const { createInvoiceItem, updateInvoiceItem, deleteInvoiceItem, findInvoiceItemById } = require('../services/invoiceItemServices')
const { findTreatmentsByIds } = require('../services/treatmentService')
const { createAuditLog } = require('../services/auditServices')
const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType, InvoiceStatus } = require('@prisma/client')

// Resolves the description/amount for a new or updated line item.
// A treatmentId derives both from the treatment unless explicitly overridden,
// and must belong to the same patient as the invoice and not already be billed.
const resolveTreatmentLinkedItem = async (invoiceRecord, treatmentId, description, amount) => {
  const [treatment] = await findTreatmentsByIds([treatmentId])
  if (!treatment) {
    return { error: { status: 404, message: 'Treatment not found' } }
  }
  if (treatment.appointment.patientId !== invoiceRecord.patientId) {
    return { error: { status: 400, message: 'Treatment does not belong to this invoice\'s patient' } }
  }
  if (treatment.invoiceItems.length > 0) {
    return { error: { status: 400, message: 'Treatment has already been invoiced' } }
  }

  return {
    data: {
      treatmentId: treatment.id,
      description: description?.trim() || treatment.procedure,
      amount: amount !== undefined ? parseFloat(amount) : treatment.amount
    }
  }
}

exports.createInvoiceItemController = async (req, res, next) => {
  const { id: invoiceId } = req.params
  const { treatmentId, description, amount } = req.body
  try {
    const invoiceRecord = await findInvoiceById(invoiceId)
    if (!invoiceRecord) {
      return res.status(404).json({ message: 'Invoice not found' })
    }
    if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
      return res.status(409).json({ message: 'Invoice is no longer a draft and cannot be edited' })
    }

    let itemData
    if (treatmentId) {
      const resolved = await resolveTreatmentLinkedItem(invoiceRecord, treatmentId, description, amount)
      if (resolved.error) {
        return res.status(resolved.error.status).json({ message: resolved.error.message })
      }
      itemData = resolved.data
    } else {
      if (!description?.trim()) {
        return res.status(400).json({ message: 'Description is required' })
      }
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'A valid amount is required' })
      }
      itemData = { treatmentId: null, description: description.trim(), amount: parseFloat(amount) }
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const item = await createInvoiceItem(invoiceId, itemData, tx)

      await createAuditLog({
        actorId: req.user.id,
        targetId: invoiceId,
        targetType: TargetType.INVOICE,
        action: AuditAction.INVOICE_ITEM_ADDED,
        metadata: { itemId: item.id, treatmentId: itemData.treatmentId, amount: itemData.amount },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return await recomputeInvoiceTotals(invoiceId, tx)
    })

    return res.status(201).json({ invoice: updatedInvoice })
  } catch (error) {
    next(error)
  }
}

exports.updateInvoiceItemController = async (req, res, next) => {
  const { id: invoiceId, itemId } = req.params
  const { treatmentId, description, amount } = req.body
  try {
    const itemRecord = await findInvoiceItemById(itemId)
    if (!itemRecord || itemRecord.invoiceId !== invoiceId) {
      return res.status(404).json({ message: 'Invoice item not found' })
    }
    if (itemRecord.invoice.status !== InvoiceStatus.DRAFT) {
      return res.status(409).json({ message: 'Invoice is no longer a draft and cannot be edited' })
    }

    let itemData
    if (treatmentId !== undefined && treatmentId !== itemRecord.treatmentId) {
      const resolved = await resolveTreatmentLinkedItem(itemRecord.invoice, treatmentId, description, amount)
      if (resolved.error) {
        return res.status(resolved.error.status).json({ message: resolved.error.message })
      }
      itemData = resolved.data
    } else {
      if (amount !== undefined && parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'A valid amount is required' })
      }
      if (description !== undefined && !description?.trim()) {
        return res.status(400).json({ message: 'Description is required' })
      }
      itemData = { description: description?.trim(), amount }
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      await updateInvoiceItem(itemId, itemData, tx)

      await createAuditLog({
        actorId: req.user.id,
        targetId: invoiceId,
        targetType: TargetType.INVOICE,
        action: AuditAction.INVOICE_ITEM_UPDATED,
        metadata: { itemId, fields: Object.keys(req.body) },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return await recomputeInvoiceTotals(invoiceId, tx)
    })

    return res.status(200).json({ invoice: updatedInvoice })
  } catch (error) {
    next(error)
  }
}

exports.deleteInvoiceItemController = async (req, res, next) => {
  const { id: invoiceId, itemId } = req.params
  try {
    const itemRecord = await findInvoiceItemById(itemId)
    if (!itemRecord || itemRecord.invoiceId !== invoiceId) {
      return res.status(404).json({ message: 'Invoice item not found' })
    }
    if (itemRecord.invoice.status !== InvoiceStatus.DRAFT) {
      return res.status(409).json({ message: 'Invoice is no longer a draft and cannot be edited' })
    }

    const invoiceRecord = await findInvoiceById(invoiceId)
    if (invoiceRecord.items.length <= 1) {
      return res.status(400).json({ message: 'Invoice must have at least one item' })
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      await deleteInvoiceItem(itemId, tx)

      await createAuditLog({
        actorId: req.user.id,
        targetId: invoiceId,
        targetType: TargetType.INVOICE,
        action: AuditAction.INVOICE_ITEM_REMOVED,
        metadata: { itemId },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return await recomputeInvoiceTotals(invoiceId, tx)
    })

    return res.status(200).json({ invoice: updatedInvoice })
  } catch (error) {
    next(error)
  }
}
