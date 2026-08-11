// services/invoiceService.js
const {
  createDraftInvoice, findInvoiceById, findAllInvoices,
  issueInvoiceById, updateInvoiceDraft, voidInvoiceById, softDeleteDraftInvoice,
} = require('../repositories/invoiceRepository');
const { findTreatmentsByIds } = require('../repositories/treatmentRepository');
const { findPatientById } = require('../repositories/patientRepository');
const { createAuditLog } = require('../repositories/auditRepository');
const { prisma } = require('../config/PrismaConfig');
const { AppError } = require('../lib/AppError');
const { AuditAction, TargetType, InvoiceStatus } = require('@prisma/client');

exports.getAllInvoicesService = async ({ take, skip, patientId, status }) =>
  findAllInvoices({
    take: Math.min(parseInt(take, 10) || 20, 100),
    skip: Math.max(parseInt(skip, 10) || 0, 0),
    patientId,
    status,
  });

exports.getInvoiceService = async (id) => {
  const invoice = await findInvoiceById(id);
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
};

exports.createInvoiceService = async (data, actor) => {
  const { patientId, treatmentIds, dueAt, billedToName, billedToEmail, billedToPhone, billedToAddress } = data;

  if (!patientId) throw new AppError('Patient is required', 400);

  const patient = await findPatientById(patientId);
  if (!patient) throw new AppError('Patient not found', 404);

  if (!treatmentIds || treatmentIds.length === 0) {
    throw new AppError('At least one treatment is required', 400);
  }

  const treatments = await findTreatmentsByIds(treatmentIds);
  if (treatments.length !== treatmentIds.length) {
    throw new AppError('One or more treatments not found', 404);
  }

  for (const treatment of treatments) {
    if (treatment.visit.patientId !== patientId) {
      throw new AppError('One or more treatments do not belong to this patient', 400);
    }
  }
  for (const treatment of treatments) {
    if (treatment.invoiceItem != null) {
      throw new AppError('One or more treatments have already been invoiced', 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    const created = await createDraftInvoice(
      { patientId, dueAt, billedToName, billedToEmail, billedToPhone, billedToAddress },
      treatments,
      tx
    );

    await createAuditLog({
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_CREATED,
      metadata: { patientId, treatmentIds },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return created;
  });
};

const ALLOWED_UPDATE_FIELDS = ['dueAt', 'notes', 'billedToName', 'billedToEmail', 'billedToPhone', 'billedToAddress'];

exports.updateInvoiceService = async (id, body, actor) => {
  const invoiceRecord = await findInvoiceById(id);
  if (!invoiceRecord) throw new AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Invoice is no longer a draft and cannot be edited', 409);
  }

  const updates = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = field === 'dueAt'
        ? (body[field] ? new Date(body[field]) : null)
        : (body[field]?.trim() || null);
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400);
  }

  return prisma.$transaction(async (tx) => {
    const result = await updateInvoiceDraft(id, updates, tx);

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return result;
  });
};

exports.issueInvoiceService = async (id, actor) => {
  const invoiceRecord = await findInvoiceById(id);
  if (!invoiceRecord) throw new AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Invoice has already been issued', 409);
  }
  if (invoiceRecord.items.length === 0) {
    throw new AppError('Invoice must have at least one item before it can be issued', 400);
  }

  return prisma.$transaction(async (tx) => {
    const { count } = await issueInvoiceById(id, tx);
    if (count === 0) {
      // Race: another request issued it between our check and this update
      throw new AppError('Invoice has already been issued', 409);
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_ISSUED,
      metadata: {},
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return findInvoiceById(id, tx);
  });
};

exports.voidInvoiceService = async (id, reason, actor) => {
  const invoiceRecord = await findInvoiceById(id);
  if (!invoiceRecord) throw new AppError('Invoice not found', 404);
  if (invoiceRecord.status === InvoiceStatus.VOIDED) {
    throw new AppError('Invoice is already voided', 409);
  }
  if (invoiceRecord.status !== InvoiceStatus.ISSUED) {
    throw new AppError('Only issued invoices can be voided', 409);
  }

  return prisma.$transaction(async (tx) => {
    const { count } = await voidInvoiceById(id, reason, tx);
    if (count === 0) {
      throw new AppError('Invoice is already voided', 409);
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_VOIDED,
      metadata: { previousStatus: invoiceRecord.status, reason },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return findInvoiceById(id, tx);
  });
};

exports.deleteInvoiceService = async (id, actor) => {
  const invoiceRecord = await findInvoiceById(id);
  if (!invoiceRecord) throw new AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Only draft invoices can be deleted', 409);
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await softDeleteDraftInvoice(id, tx);
    if (count === 0) {
      throw new AppError('Only draft invoices can be deleted', 409);
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_DELETED,
      metadata: { previousStatus: invoiceRecord.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);
  });
};