const { VisitStatus, TreatmentPlanStatus, UserStatus, AuditAction, TargetType } = require('@prisma/client')
const { findVisitById } = require('../repositories/visitRepository')
const { findTreatmentPlanById } = require('../repositories/treatmentPlanRepository')
const { findUserById } = require('../repositories/userRepository')
const {
  findAllTreatments,
  findTreatmentById,
  findTreatmentsByVisitId,
  findUnbilledTreatmentsByPatient,
  findAllTreatmentsByPatient,
  createTreatment,
  updateTreatment,
  softDeleteTreatment
} = require('../repositories/treatmentRepository')
const { findProcedureById } = require('../repositories/procedureCatalogRepository')
const { findPatientById } = require('../repositories/patientRepository')

const { createAuditLog } = require('../repositories/auditRepository')
const { AppError } = require('../lib/AppError')

const { prisma } = require('../config/PrismaConfig')

const TERMINAL_VISIT_STATUSES = [VisitStatus.COMPLETED, VisitStatus.CANCELLED]
const CLOSED_PLAN_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]

exports.getAllTreatmentsService = async ({ take = 20, skip = 0 }) => {
  return await findAllTreatments({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip)
  })
}

exports.getTreatmentService = async (id) => {
  const treatment = await findTreatmentById(id)
  if (!treatment) {
    throw new AppError('Treatment not found', 404)
  }
  return treatment
}

// Replaces getTreatmentByAppointmentService — a visit can have zero, one, or
// many treatments now, so an empty list is a valid result, not a 404.
exports.getTreatmentsByVisitService = async (visitId) => {
  const visit = await findVisitById(visitId)
  if (!visit) {
    throw new AppError('Visit not found', 404)
  }
  return await findTreatmentsByVisitId(visitId)
}

exports.getUnbilledTreatmentsService = async (patientId) => {
  const patient = await findPatientById(patientId)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }
  return await findUnbilledTreatmentsByPatient(patientId)
}

exports.getAllTreatmentsByPatientService = async (patientId) => {
  const patient = await findPatientById(patientId)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }
  return await findAllTreatmentsByPatient(patientId)
}

exports.createTreatmentService = async ({ visitId, treatmentPlanId, performedById, procedureCatalogId, procedure, toothNumber, notes, amount }, actor) => {
  if (!visitId || !procedure || amount === undefined) {
    throw new AppError('Visit, procedure and amount are required', 400)
  }

  const visit = await findVisitById(visitId)
  if (!visit) {
    throw new AppError('Visit not found', 404)
  }
  if (TERMINAL_VISIT_STATUSES.includes(visit.status)) {
    throw new AppError('Cannot add a treatment to a completed or cancelled visit', 400)
  }

  if (procedureCatalogId) {
    const catalogEntry = await findProcedureById(procedureCatalogId)
    if (!catalogEntry) {
      throw new AppError('Procedure not found', 404)
    }
  }

  if (treatmentPlanId) {
    const plan = await findTreatmentPlanById(treatmentPlanId)
    if (!plan) {
      throw new AppError('Treatment plan not found', 404)
    }
    if (plan.patientId !== visit.patientId) {
      throw new AppError('Treatment plan does not belong to this patient', 400)
    }
    if (CLOSED_PLAN_STATUSES.includes(plan.status)) {
      throw new AppError('Cannot attach a treatment to a completed or cancelled plan', 409)
    }
  }

  if (performedById) {
    const performer = await findUserById(performedById)
    if (!performer || performer.status !== UserStatus.ACTIVE) {
      throw new AppError('Performer not found', 404)
    }
    // Assumption worth confirming: should performedById be restricted to
    // someone already listed as a VisitProvider on this visit? Left
    // unrestricted for now — flagging rather than silently deciding.
  }

  const parsedAmount = parseFloat(amount)
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    throw new AppError('Amount must be a positive number', 400)
  }

  return prisma.$transaction(async (tx) => {
    const created = await createTreatment({
      visitId,
      treatmentPlanId: treatmentPlanId || null,
      performedById: performedById || null,
      procedureCatalogId: procedureCatalogId || null,
      procedure,
      toothNumber: toothNumber ? parseInt(toothNumber) : null,
      notes,
      amount: parsedAmount
    }, tx)

    await createAuditLog({
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

exports.updateTreatmentService = async (id, body, actor) => {
  const treatment = await findTreatmentById(id)
  if (!treatment) {
    throw new AppError('Treatment not found', 404)
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
    throw new AppError('No valid fields provided', 400)
  }

  if ('treatmentPlanId' in updates) {
    if (updates.treatmentPlanId === null) {
      // Detaching — block if the treatment's *current* plan is closed.
      if (treatment.treatmentPlanId && CLOSED_PLAN_STATUSES.includes(treatment.treatmentPlan?.status)) {
        throw new AppError('Cannot detach a treatment from a completed or cancelled plan', 409)
      }
    } else {
      // Attaching — unchanged from before.
      const plan = await findTreatmentPlanById(updates.treatmentPlanId)
      if (!plan) {
        throw new AppError('Treatment plan not found', 404)
      }
      if (plan.patientId !== treatment.visit.patientId) {
        throw new AppError('Treatment plan does not belong to this patient', 400)
      }
      if (CLOSED_PLAN_STATUSES.includes(plan.status)) {
        throw new AppError('Cannot attach a treatment to a completed or cancelled plan', 409)
      }
    }
  }

  if (updates.performedById) {
    const performer = await findUserById(updates.performedById)
    if (!performer || performer.status !== UserStatus.ACTIVE) {
      throw new AppError('Performer not found', 404)
    }
  }

  return prisma.$transaction(async (tx) => {
    const result = await updateTreatment(id, updates, tx)
    await createAuditLog({
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

exports.deleteTreatmentService = async (id, actor) => {
  const treatment = await findTreatmentById(id)
  if (!treatment) {
    throw new AppError('Treatment not found', 404)
  }
  // Was missing before this rework — mirrors the same guard deleteVisitService
  // already has for its cascaded treatments.
  if (treatment.invoiceItem != null) {
    throw new AppError('Cannot delete a treatment that has already been invoiced', 409)
  }

  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.TREATMENT,
      action: AuditAction.TREATMENT_DELETED,
      metadata: { procedure: treatment.procedure },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await softDeleteTreatment(id, tx)
  })
}