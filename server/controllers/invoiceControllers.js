const {
  createDraftInvoice,
  findInvoiceById,
  findAllInvoices,
  issueInvoiceById,
  updateInvoiceDraft,
  voidInvoiceById,
  softDeleteDraftInvoice
} = require('../services/invoiceServices')
const { findTreatmentsByIds } = require('../services/treatmentService')
const { findPatientById } = require('../services/patientService')
const { createAuditLog } = require('../services/auditServices')
const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType, InvoiceStatus } = require('@prisma/client')

exports.getAllInvoicesController = async (req, res, next) => {
  const { take = 20, skip = 0, patientId, status } = req.query
  try {
    const result = await findAllInvoices({
      take: Math.min(parseInt(take), 100),
      skip: parseInt(skip),
      patientId,
      status
    })
    return res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

exports.getInvoiceController = async (req, res, next) => {
  const { id } = req.params
  try {
    const invoice = await findInvoiceById(id)
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' })
    }
    return res.status(200).json({ invoice })
  } catch (error) {
    next(error)
  }
}

exports.createInvoiceController = async (req, res, next) => {
  const {
    patientId,
    treatmentIds,
    dueAt,
    billedToName,
    billedToEmail,
    billedToPhone,
    billedToAddress
  } = req.body

  try {
    if (!patientId) {
      return res.status(400).json({ message: 'Patient is required' })
    }

    const patient = await findPatientById(patientId)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    if (!treatmentIds || treatmentIds.length === 0) {
      return res.status(400).json({ message: 'At least one treatment is required' })
    }

    const treatments = await findTreatmentsByIds(treatmentIds)

    if (treatments.length !== treatmentIds.length) {
      return res.status(404).json({ message: 'One or more treatments not found' })
    }

    const allBelongToPatient = treatments.every(t => t.appointment.patientId === patientId)
    if (!allBelongToPatient) {
      return res.status(400).json({ message: 'One or more treatments do not belong to this patient' })
    }

    const alreadyInvoiced = treatments.some(t => t.invoiceItems.length > 0)
    if (alreadyInvoiced) {
      return res.status(400).json({ message: 'One or more treatments have already been invoiced' })
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await createDraftInvoice({
        patientId,
        dueAt,
        billedToName,
        billedToEmail,
        billedToPhone,
        billedToAddress
      }, treatments, tx)

      await createAuditLog({
        actorId: req.user.id,
        targetId: created.id,
        targetType: TargetType.INVOICE,
        action: AuditAction.INVOICE_CREATED,
        metadata: { patientId, treatmentIds },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return created
    })

    return res.status(201).json({ invoice })

  } catch (error) {
    next(error)
  }
}

exports.updateInvoiceController = async (req, res, next) => {
  const { id } = req.params
  try {
    if (!id) {
      return res.status(400).json({
        message: 'Missing credentials'
      })
    }

    const invoiceRecord = await findInvoiceById(id)
    if (!invoiceRecord) {
      return res.status(404).json({ message: 'Invoice not found' })
    }

    if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
      return res.status(409).json({ message: 'Invoice is no longer a draft and cannot be edited' })
    }

    const allowedFields = ['dueAt', 'notes', 'billedToName', 'billedToEmail', 'billedToPhone', 'billedToAddress']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'dueAt') {
          updates[field] = req.body[field] ? new Date(req.body[field]) : null
        } else {
          updates[field] = req.body[field]?.trim() || null  // '' → null
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const result = await updateInvoiceDraft(id, updates, tx)

      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.INVOICE,
        action: AuditAction.INVOICE_UPDATED,
        metadata: { fields: Object.keys(updates) },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return result
    })

    return res.status(200).json({
      invoice: updatedInvoice
    })

  } catch (error) {
    next(error)
  }
}

exports.issueInvoiceController = async (req, res, next) => {
  const { id } = req.params
  try {
    if (!id) {
      return res.status(400).json({
        message: 'Missing credentials'
      })
    }

    const invoiceRecord = await findInvoiceById(id)
    if (!invoiceRecord) {
      return res.status(404).json({ message: 'Invoice not found' })
    }

    if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
      return res.status(409).json({ message: 'Invoice has already been issued' })
    }

    if (invoiceRecord.items.length === 0) {
      return res.status(400).json({ message: 'Invoice must have at least one item before it can be issued' })
    }

    const issuedInvoice = await prisma.$transaction(async (tx) => {
      const { count } = await issueInvoiceById(id, tx)
      if (count === 0) {
        const conflict = new Error('Invoice has already been issued')
        conflict.statusCode = 409
        throw conflict
      }

      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.INVOICE,
        action: AuditAction.INVOICE_ISSUED,
        metadata: {},
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return await findInvoiceById(id, tx)
    })

    return res.status(200).json({
      invoice: issuedInvoice
    })

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message })
    }
    next(error)
  }
}

exports.voidInvoiceController = async (req, res, next) => {
  const { id } = req.params
  const { reason } = req.body
  try {
    const invoiceRecord = await findInvoiceById(id)
    if (!invoiceRecord) {
      return res.status(404).json({ message: 'Invoice not found' })
    }
    if (invoiceRecord.status === InvoiceStatus.VOIDED) {
      return res.status(409).json({ message: 'Invoice is already voided' })
    }
    if (invoiceRecord.status !== InvoiceStatus.ISSUED) {
      return res.status(409).json({ message: 'Only issued invoices can be voided' })
    }

    const voidedInvoice = await prisma.$transaction(async (tx) => {
      const { count } = await voidInvoiceById(id, reason, tx)
      if (count === 0) {
        const conflict = new Error('Invoice is already voided')
        conflict.statusCode = 409
        throw conflict
      }
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.INVOICE,
        action: AuditAction.INVOICE_VOIDED,
        metadata: { previousStatus: invoiceRecord.status, reason },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      return await findInvoiceById(id, tx)
    })

    return res.status(200).json({ invoice: voidedInvoice })
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
    next(error)
  }
}

exports.deleteInvoiceController = async (req, res, next) => {
  const { id } = req.params
  try {
    const invoiceRecord = await findInvoiceById(id)
    if (!invoiceRecord) {
      return res.status(404).json({ message: 'Invoice not found' })
    }
    if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
      return res.status(409).json({ message: 'Only draft invoices can be deleted' })
    }

    const { count } = await softDeleteDraftInvoice(id)
    if (count === 0) {
      return res.status(409).json({ message: 'Only draft invoices can be deleted' })
    }

    await createAuditLog({
      actorId: req.user.id,
      targetId: id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_DELETED,
      metadata: { previousStatus: invoiceRecord.status },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(204).send()
  } catch (error) {
    next(error)
  }
}