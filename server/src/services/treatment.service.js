import * as visitRepository from '../repositories/visit.repository.js';
import * as treatmentPlanRepository from '../repositories/treatmentPlan.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as treatmentRepository from '../repositories/treatment.repository.js';
import * as procedureCatalogRepository from '../repositories/procedureCatalog.repository.js';
import * as patientRepository from '../repositories/patient.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as appError from '../lib/AppError.js';
import * as prismaConfig from '../config/prisma.config.js';
import { TargetType, VisitStatus, TreatmentPlanStatus, UserStatus, AuditAction } from '@prisma/client';
const TERMINAL_VISIT_STATUSES = [VisitStatus.COMPLETED, VisitStatus.CANCELLED]
const CLOSED_PLAN_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]

export const getAllTreatmentsService = async ({ take = 20, skip = 0 }) => {
  return await treatmentRepository.findAllTreatments({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip)
  })
}

export const getTreatmentService = async (id) => {
  const treatment = await treatmentRepository.findTreatmentById(id)
  if (!treatment) {
    throw new appError.AppError('Treatment not found', 404)
  }
  return treatment
}

// Replaces getTreatmentByAppointmentService — a visit can have zero, one, or
// many treatments now, so an empty list is a valid result, not a 404.
export const getTreatmentsByVisitService = async (visitId) => {
  const visit = await visitRepository.findVisitById(visitId)
  if (!visit) {
    throw new appError.AppError('Visit not found', 404)
  }
  return await treatmentRepository.findTreatmentsByVisitId(visitId)
}

export const getUnbilledTreatmentsService = async (patientId) => {
  const patient = await patientRepository.findPatientById(patientId)
  if (!patient) {
    throw new appError.AppError('Patient not found', 404)
  }
  return await treatmentRepository.findUnbilledTreatmentsByPatient(patientId)
}

export const getAllTreatmentsByPatientService = async (patientId) => {
  const patient = await patientRepository.findPatientById(patientId)
  if (!patient) {
    throw new appError.AppError('Patient not found', 404)
  }
  return await treatmentRepository.findAllTreatmentsByPatient(patientId)
}

export const createTreatmentService = async ({ visitId, treatmentPlanId, performedById, procedureCatalogId, procedure, toothNumber, notes, amount }, actor) => {
  if (!visitId || !procedure || amount === undefined) {
    throw new appError.AppError('Visit, procedure and amount are required', 400)
  }

  const visit = await visitRepository.findVisitById(visitId)
  if (!visit) {
    throw new appError.AppError('Visit not found', 404)
  }
  if (TERMINAL_VISIT_STATUSES.includes(visit.status)) {
    throw new appError.AppError('Cannot add a treatment to a completed or cancelled visit', 400)
  }

  if (procedureCatalogId) {
    const catalogEntry = await procedureCatalogRepository.findProcedureById(procedureCatalogId)
    if (!catalogEntry) {
      throw new appError.AppError('Procedure not found', 404)
    }
  }

  if (treatmentPlanId) {
    const plan = await treatmentPlanRepository.findTreatmentPlanById(treatmentPlanId)
    if (!plan) {
      throw new appError.AppError('Treatment plan not found', 404)
    }
    if (plan.patientId !== visit.patientId) {
      throw new appError.AppError('Treatment plan does not belong to this patient', 400)
    }
    if (CLOSED_PLAN_STATUSES.includes(plan.status)) {
      throw new appError.AppError('Cannot attach a treatment to a completed or cancelled plan', 409)
    }
  }

  if (performedById) {
    const performer = await userRepository.findUserById(performedById)
    if (!performer || performer.status !== UserStatus.ACTIVE) {
      throw new appError.AppError('Performer not found', 404)
    }
    // Assumption worth confirming: should performedById be restricted to
    // someone already listed as a VisitProvider on this visit? Left
    // unrestricted for now — flagging rather than silently deciding.
  }

  const parsedAmount = parseFloat(amount)
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    throw new appError.AppError('Amount must be a positive number', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const created = await treatmentRepository.createTreatment({
      visitId,
      treatmentPlanId: treatmentPlanId || null,
      performedById: performedById || null,
      procedureCatalogId: procedureCatalogId || null,
      procedure,
      toothNumber: toothNumber ? parseInt(toothNumber) : null,
      notes,
      amount: parsedAmount
    }, tx)

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.TREATMENT,
      action: AuditAction.TREATMENT_CREATED,
      metadata: { visitId, treatmentPlanId: treatmentPlanId || null, procedure, toothNumber: created.toothNumber, amount: created.amount },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })
}

export const updateTreatmentService = async (id, body, actor) => {
  const treatment = await treatmentRepository.findTreatmentById(id)
  if (!treatment) {
    throw new appError.AppError('Treatment not found', 404)
  }

  const allowedFields = ['procedure', 'toothNumber', 'notes', 'amount', 'treatmentPlanId', 'performedById']
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'toothNumber') updates[field] = body[field] === null ? null : parseInt(body[field])
      else if (field === 'amount') updates[field] = parseFloat(body[field])
      else if (field === 'treatmentPlanId' || field === 'performedById') updates[field] = body[field] || null
      else updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new appError.AppError('No valid fields provided', 400)
  }

  if ('treatmentPlanId' in updates) {
    if (updates.treatmentPlanId === null) {
      // Detaching — block if the treatment's *current* plan is closed.
      if (treatment.treatmentPlanId && CLOSED_PLAN_STATUSES.includes(treatment.treatmentPlan?.status)) {
        throw new appError.AppError('Cannot detach a treatment from a completed or cancelled plan', 409)
      }
    } else {
      // Attaching — unchanged from before.
      const plan = await treatmentPlanRepository.findTreatmentPlanById(updates.treatmentPlanId)
      if (!plan) {
        throw new appError.AppError('Treatment plan not found', 404)
      }
      if (plan.patientId !== treatment.visit.patientId) {
        throw new appError.AppError('Treatment plan does not belong to this patient', 400)
      }
      if (CLOSED_PLAN_STATUSES.includes(plan.status)) {
        throw new appError.AppError('Cannot attach a treatment to a completed or cancelled plan', 409)
      }
    }
  }

  if (updates.performedById) {
    const performer = await userRepository.findUserById(updates.performedById)
    if (!performer || performer.status !== UserStatus.ACTIVE) {
      throw new appError.AppError('Performer not found', 404)
    }
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const result = await treatmentRepository.updateTreatment(id, updates, tx)
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.TREATMENT,
      action: AuditAction.TREATMENT_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    return result
  })
}

export const deleteTreatmentService = async (id, actor) => {
  const treatment = await treatmentRepository.findTreatmentById(id)
  if (!treatment) {
    throw new appError.AppError('Treatment not found', 404)
  }
  // Was missing before this rework — mirrors the same guard deleteVisitService
  // already has for its cascaded treatments.
  if (treatment.invoiceItem != null) {
    throw new appError.AppError('Cannot delete a treatment that has already been invoiced', 409)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.TREATMENT,
      action: AuditAction.TREATMENT_DELETED,
      metadata: { procedure: treatment.procedure },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await treatmentRepository.softDeleteTreatment(id, tx)
  })
}