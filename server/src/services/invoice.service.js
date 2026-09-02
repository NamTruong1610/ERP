// services/invoiceService.js
import * as invoiceRepository from '../repositories/invoice.repository.js';
import * as treatmentRepository from '../repositories/treatment.repository.js';
import * as patientRepository from '../repositories/patient.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { AuditAction, TargetType, InvoiceStatus } from '@prisma/client';

export const getAllInvoicesService = async ({ take, skip, patientId, status }) =>
  invoiceRepository.findAllInvoices({
    take: Math.min(parseInt(take, 10) || 20, 100),
    skip: Math.max(parseInt(skip, 10) || 0, 0),
    patientId,
    status,
  });

export const getInvoiceService = async (id) => {
  const invoice = await invoiceRepository.findInvoiceById(id);
  if (!invoice) throw new appError.AppError('Invoice not found', 404);
  return invoice;
};

export const createInvoiceService = async (data, actor) => {
  const { patientId, treatmentIds, dueAt, billedToName, billedToEmail, billedToPhone, billedToAddress } = data;

  if (!patientId) throw new appError.AppError('Patient is required', 400);

  const patient = await patientRepository.findPatientById(patientId);
  if (!patient) throw new appError.AppError('Patient not found', 404);

  if (!treatmentIds || treatmentIds.length === 0) {
    throw new appError.AppError('At least one treatment is required', 400);
  }

  const treatments = await treatmentRepository.findTreatmentsByIds(treatmentIds);
  if (treatments.length !== treatmentIds.length) {
    throw new appError.AppError('One or more treatments not found', 404);
  }

  for (const treatment of treatments) {
    if (treatment.visit.patientId !== patientId) {
      throw new appError.AppError('One or more treatments do not belong to this patient', 400);
    }
  }
  for (const treatment of treatments) {
    if (treatment.invoiceItem != null) {
      throw new appError.AppError('One or more treatments have already been invoiced', 400);
    }
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const created = await invoiceRepository.createDraftInvoice(
      { patientId, dueAt, billedToName, billedToEmail, billedToPhone, billedToAddress },
      treatments,
      tx
    );

    await auditRepository.createAuditLog({
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

export const updateInvoiceService = async (id, body, actor) => {
  const invoiceRecord = await invoiceRepository.findInvoiceById(id);
  if (!invoiceRecord) throw new appError.AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new appError.AppError('Invoice is no longer a draft and cannot be edited', 409);
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
    throw new appError.AppError('No valid fields provided', 400);
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const result = await invoiceRepository.updateInvoiceDraft(id, updates, tx);

    await auditRepository.createAuditLog({
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

export const issueInvoiceService = async (id, actor) => {
  const invoiceRecord = await invoiceRepository.findInvoiceById(id);
  if (!invoiceRecord) throw new appError.AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new appError.AppError('Invoice has already been issued', 409);
  }
  if (invoiceRecord.items.length === 0) {
    throw new appError.AppError('Invoice must have at least one item before it can be issued', 400);
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const { count } = await invoiceRepository.issueInvoiceById(id, tx);
    if (count === 0) {
      // Race: another request issued it between our check and this update
      throw new appError.AppError('Invoice has already been issued', 409);
    }

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_ISSUED,
      metadata: {},
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return invoiceRepository.findInvoiceById(id, tx);
  });
};

export const voidInvoiceService = async (id, reason, actor) => {
  const invoiceRecord = await invoiceRepository.findInvoiceById(id);
  if (!invoiceRecord) throw new appError.AppError('Invoice not found', 404);
  if (invoiceRecord.status === InvoiceStatus.VOIDED) {
    throw new appError.AppError('Invoice is already voided', 409);
  }
  if (invoiceRecord.status !== InvoiceStatus.ISSUED) {
    throw new appError.AppError('Only issued invoices can be voided', 409);
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const { count } = await invoiceRepository.voidInvoiceById(id, reason, tx);
    if (count === 0) {
      throw new appError.AppError('Invoice is already voided', 409);
    }

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.INVOICE,
      action: AuditAction.INVOICE_VOIDED,
      metadata: { previousStatus: invoiceRecord.status, reason },
      ip: actor.ip,
      userAgent: actor.userAgent,
    }, tx);

    return invoiceRepository.findInvoiceById(id, tx);
  });
};

export const deleteInvoiceService = async (id, actor) => {
  const invoiceRecord = await invoiceRepository.findInvoiceById(id);
  if (!invoiceRecord) throw new appError.AppError('Invoice not found', 404);
  if (invoiceRecord.status !== InvoiceStatus.DRAFT) {
    throw new appError.AppError('Only draft invoices can be deleted', 409);
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    const { count } = await invoiceRepository.softDeleteDraftInvoice(id, tx);
    if (count === 0) {
      throw new appError.AppError('Only draft invoices can be deleted', 409);
    }

    await auditRepository.createAuditLog({
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