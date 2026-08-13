const { TreatmentPlanStatus, PlanItemStatus, AuditAction, TargetType } = require('@prisma/client')
const { prisma } = require('../config/PrismaConfig')
const { AppError } = require('../lib/AppError')
const { createAuditLog } = require('../repositories/auditRepository')
const { findPatientById } = require('../repositories/patientRepository')
const { findTreatmentsByIds } = require('../repositories/treatmentRepository')
const {
  findAllTreatmentPlans,
  findTreatmentPlanById,
  createTreatmentPlan,
  updateTreatmentPlanById,
  softDeleteTreatmentPlan,
  attachTreatmentsToPlan,
  cancelProposedItemsByPlanId
} = require('../repositories/treatmentPlanRepository')
const { createTreatmentPlanItemsBulk } = require('../repositories/treatmentPlanItemRepository')

const { findProceduresByIds } = require('../repositories/procedureCatalogRepository')

const CLOSED_PLAN_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]
const TERMINAL_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]
const VALID_STATUS_TARGETS = [TreatmentPlanStatus.ACTIVE, TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]

exports.getAllTreatmentPlansService = async ({ take = 20, skip = 0, patientId }) => {
  return await findAllTreatmentPlans({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    patientId
  })
}

exports.getTreatmentPlanService = async (id) => {
  const treatmentPlan = await findTreatmentPlanById(id)
  if (!treatmentPlan) {
    throw new AppError('Treatment plan not found', 404)
  }
  return treatmentPlan
}

// Creates just the plan shell — patientId, title, notes. Items and treatments
// are attached afterward via addTreatmentPlanItemsBulkService /
// attachTreatmentsToTreatmentPlanService, deliberately kept separate so
// creation stays a single, cheap, transaction-light operation.
exports.createTreatmentPlanService = async ({ patientId, title, notes }, actor) => {
  if (!patientId) {
    throw new AppError('Patient is required', 400)
  }
  if (!title?.trim()) {
    throw new AppError('Title is required', 400)
  }

  const patientRecord = await findPatientById(patientId)
  if (!patientRecord) {
    throw new AppError('Patient not found', 404)
  }

  return prisma.$transaction(async (tx) => {
    const created = await createTreatmentPlan({
      patientId,
      createdById: actor.id,
      title: title.trim(),
      notes: notes?.trim() || null,
      status: TreatmentPlanStatus.PROPOSED
    }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.TREATMENT_PLAN,
      action: AuditAction.TREATMENT_PLAN_CREATED,
      metadata: { patientId, title: created.title },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })
}

exports.addTreatmentPlanItemsBulkService = async (planId, { items }, actor) => {
  const plan = await findTreatmentPlanById(planId)
  if (!plan) {
    throw new AppError('Treatment plan not found', 404)
  }
  if (CLOSED_PLAN_STATUSES.includes(plan.status)) {
    throw new AppError('Cannot add items to a completed or cancelled plan', 409)
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one item is required', 400)
  }

  const catalogIds = [...new Set(items.map(i => i.procedureCatalogId).filter(Boolean))]
  if (catalogIds.length) {
    const found = await findProceduresByIds(catalogIds)
    if (found.length !== catalogIds.length) {
      throw new AppError('One or more procedures not found', 404)
    }
  }

  const parsed = items.map((item, i) => {
    if (!item.procedure?.trim()) {
      throw new AppError(`Item ${i + 1}: procedure is required`, 400)
    }
    const estimatedAmount = parseFloat(item.estimatedAmount)
    if (!item.estimatedAmount || isNaN(estimatedAmount) || estimatedAmount <= 0) {
      throw new AppError(`Item ${i + 1}: a valid estimated amount is required`, 400)
    }
    return {
      treatmentPlanId: planId,
      procedureCatalogId: item.procedureCatalogId || null,
      procedure: item.procedure.trim(),
      toothNumber: item.toothNumber ? parseInt(item.toothNumber) : null,
      estimatedAmount,
      status: PlanItemStatus.PROPOSED
    }
  })

  return prisma.$transaction(async (tx) => {
    const created = await createTreatmentPlanItemsBulk(parsed, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: planId,
      targetType: TargetType.TREATMENT_PLAN,
      action: AuditAction.TREATMENT_PLAN_ITEM_ADDED,
      metadata: { itemIds: created.map(c => c.id), count: created.length },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })
}

exports.attachTreatmentsToTreatmentPlanService = async (treatmentPlanId, treatmentIds, actor) => {
  if (!Array.isArray(treatmentIds) || treatmentIds.length === 0) {
    throw new AppError('At least one treatment is required', 400)
  }

  const treatmentPlanRecord = await findTreatmentPlanById(treatmentPlanId)
  if (!treatmentPlanRecord) {
    throw new AppError('Treatment plan not found', 404)
  }
  if (CLOSED_PLAN_STATUSES.includes(treatmentPlanRecord.status)) {
    throw new AppError('Cannot attach treatments to a completed or cancelled plan', 409)
  }

  const treatments = await findTreatmentsByIds(treatmentIds)
  if (treatments.length !== treatmentIds.length) {
    throw new AppError('One or more treatments not found', 404)
  }
  for (const t of treatments) {
    if (t.visit.patientId !== treatmentPlanRecord.patientId) {
      throw new AppError('One or more treatments do not belong to this patient', 400)
    }
  }

  return prisma.$transaction(async (tx) => {
    await attachTreatmentsToPlan(treatmentPlanId, treatmentIds, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: treatmentPlanId,
      targetType: TargetType.TREATMENT_PLAN,
      action: AuditAction.TREATMENT_PLAN_UPDATED,
      metadata: { attachedTreatmentIds: treatmentIds },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return findTreatmentPlanById(treatmentPlanId, tx)
  })
}

exports.updateTreatmentPlanService = async (id, body, actor) => {
  const plan = await findTreatmentPlanById(id)
  if (!plan) {
    throw new AppError('Treatment plan not found', 404)
  }

  const updates = {}

  // title/notes stay editable for the plan's entire life, regardless of
  // status — unlike Visit, where every field locks once terminal. A plan's
  // title/notes carry no patient-facing "quote" weight the way
  // TreatmentPlanItem.estimatedAmount does, so there's nothing here worth
  // freezing.
  if (body.title !== undefined) {
    if (!body.title?.trim()) {
      throw new AppError('Title is required', 400)
    }
    updates.title = body.title.trim()
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes?.trim() || null
  }

  // Status is the one thing that DOES lock once the plan is terminal.
  if (body.status !== undefined) {
    if (TERMINAL_STATUSES.includes(plan.status)) {
      throw new AppError('Cannot change the status of a completed or cancelled plan', 409)
    }
    if (!VALID_STATUS_TARGETS.includes(body.status)) {
      throw new AppError(`Status must be one of: ${VALID_STATUS_TARGETS.join(', ')}`, 400)
    }
    if (body.status === TreatmentPlanStatus.COMPLETED) {
      const hasOpenItems = plan.treatmentPlanItems.some(i => i.status === PlanItemStatus.PROPOSED)
      if (hasOpenItems) {
        throw new AppError('Cannot complete a plan while it still has proposed items — resolve or cancel them first', 409)
      }
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400)
  }

  return prisma.$transaction(async (tx) => {
    await updateTreatmentPlanById(id, updates, tx)

    // Cancelling cascades to any still-PROPOSED items — a proposal sitting
    // under a cancelled plan is a contradiction. COMPLETED items and any
    // already-attached Treatment records are untouched — they're historical
    // fact, independent of the plan's own outcome.
    if (updates.status === TreatmentPlanStatus.CANCELLED) {
      await cancelProposedItemsByPlanId(id, tx)
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.TREATMENT_PLAN,
      action: updates.status === TreatmentPlanStatus.CANCELLED
        ? AuditAction.TREATMENT_PLAN_CANCELLED
        : AuditAction.TREATMENT_PLAN_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    // Refetch when status changed so the response reflects any cascaded
    // item statuses too, not the pre-cascade snapshot.
    return updates.status ? await findTreatmentPlanById(id, tx) : await findTreatmentPlanById(id, tx)
  })
}