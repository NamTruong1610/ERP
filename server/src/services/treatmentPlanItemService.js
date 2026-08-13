const { PlanItemStatus, TreatmentPlanStatus, AuditAction, TargetType } = require('@prisma/client')
const { prisma } = require('../config/PrismaConfig')
const { AppError } = require('../lib/AppError')
const { createAuditLog } = require('../repositories/auditRepository')
const { findTreatmentPlanById } = require('../repositories/treatmentPlanRepository')
const {
  findTreatmentPlanItemById,
  createTreatmentPlanItem,
  updateTreatmentPlanItemById,
  deleteTreatmentPlanItemById
} = require('../repositories/treatmentPlanItemRepository')

const {
  findProcedureById
} = require('../repositories/procedureCatalogRepository')

const CLOSED_PLAN_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]

exports.createTreatmentPlanItemService = async ({ treatmentPlanId, procedureCatalogId, procedure, toothNumber, estimatedAmount }, actor) => {
  const treatmentPlanRecord = await findTreatmentPlanById(treatmentPlanId)
  if (!treatmentPlanRecord) {
    throw new AppError('Treatment plan not found', 404)
  }
  if (CLOSED_PLAN_STATUSES.includes(treatmentPlanRecord.status)) {
    throw new AppError('Cannot add items to a completed or cancelled plan', 409)
  }

  if (procedureCatalogId) {
    const catalogEntry = await findProcedureById(procedureCatalogId)
    if (!catalogEntry) {
      throw new AppError('Procedure not found', 404)
    }
  }

  if (!procedure?.trim()) {
    throw new AppError('Procedure is required', 400)
  }
  const parsedAmount = parseFloat(estimatedAmount)
  if (!estimatedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new AppError('A valid estimated amount is required', 400)
  }
  const parsedTooth = toothNumber !== undefined && toothNumber !== null
    ? parseInt(toothNumber)
    : null
  if (parsedTooth !== null && (isNaN(parsedTooth) || parsedTooth < 1 || parsedTooth > 32)) {
    throw new AppError('Invalid tooth number', 400)
  }

  return prisma.$transaction(async (tx) => {
    const created = await createTreatmentPlanItem({
      treatmentPlanId: treatmentPlanRecord.id,
      procedureCatalogId: procedureCatalogId || null,
      procedure: procedure.trim(),
      toothNumber: parsedTooth,
      estimatedAmount: parsedAmount,
      status: PlanItemStatus.PROPOSED
    }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.TREATMENT_PLAN_ITEM,
      action: AuditAction.TREATMENT_PLAN_ITEM_ADDED,
      metadata: { treatmentPlanId: treatmentPlanRecord.id, procedure: created.procedure, estimatedAmount: created.estimatedAmount },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })
}

exports.editTreatmentPlanItemService = async ({ itemId, procedure, toothNumber, estimatedAmount }, actor) => {
  const treatmentPlanItemRecord = await findTreatmentPlanItemById(itemId)
  if (!treatmentPlanItemRecord) {
    throw new AppError('Treatment plan item not found', 404)
  }
  if (treatmentPlanItemRecord.status === PlanItemStatus.COMPLETED) {
    throw new AppError('Cannot edit an item that has already been converted to a treatment', 409)
  }

  const updates = {}

  if (procedure !== undefined) {
    if (!procedure?.trim()) {
      throw new AppError('Procedure is required', 400)
    }
    updates.procedure = procedure.trim()
  }

  if (estimatedAmount !== undefined) {
    const parsedAmount = parseFloat(estimatedAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('A valid estimated amount is required', 400)
    }
    updates.estimatedAmount = parsedAmount
  }

  if (toothNumber !== undefined) {
    const parsedTooth = toothNumber === null ? null : parseInt(toothNumber)
    if (parsedTooth !== null && (isNaN(parsedTooth) || parsedTooth < 1 || parsedTooth > 32)) {
      throw new AppError('Invalid tooth number', 400)
    }
    updates.toothNumber = parsedTooth
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateTreatmentPlanItemById(itemId, updates, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: itemId,
      targetType: TargetType.TREATMENT_PLAN_ITEM,
      action: AuditAction.TREATMENT_PLAN_ITEM_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return updated
  })
}

exports.relocateTreatmentPlanItemService = async ({ itemId, treatmentPlanId }, actor) => {
  const [treatmentPlanItemRecord, treatmentPlanRecord] = await Promise.all([
    findTreatmentPlanItemById(itemId),
    findTreatmentPlanById(treatmentPlanId)
  ])

  if (!treatmentPlanRecord) {
    throw new AppError('Treatment plan not found', 404)
  }
  if (!treatmentPlanItemRecord) {
    throw new AppError('Treatment plan item not found', 404)
  }
  if (treatmentPlanItemRecord.status === PlanItemStatus.COMPLETED) {
    throw new AppError('Cannot relocate an item that has already been converted to a treatment', 409)
  }
  if (CLOSED_PLAN_STATUSES.includes(treatmentPlanRecord.status)) {
    throw new AppError('Cannot relocate an item to a completed or cancelled plan', 409)
  }
  // Assumes findTreatmentPlanItemById includes { treatmentPlan: { select: { patientId: true } } } —
  // confirm the repo actually returns this before relying on it here.
  if (treatmentPlanItemRecord.treatmentPlan.patientId !== treatmentPlanRecord.patientId) {
    throw new AppError('Target treatment plan does not belong to the same patient', 400)
  }

  const fromPlanId = treatmentPlanItemRecord.treatmentPlanId

  return prisma.$transaction(async (tx) => {
    const updated = await updateTreatmentPlanItemById(itemId, {
      treatmentPlanId: treatmentPlanRecord.id
    }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: itemId,
      targetType: TargetType.TREATMENT_PLAN_ITEM,
      action: AuditAction.TREATMENT_PLAN_ITEM_UPDATED,
      metadata: { fromPlanId, toPlanId: treatmentPlanRecord.id },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return updated
  })
}

exports.removeTreatmentPlanItemService = async ({ itemId }, actor) => {
  const treatmentPlanItemRecord = await findTreatmentPlanItemById(itemId)
  if (!treatmentPlanItemRecord) {
    throw new AppError('Treatment plan item not found', 404)
  }
  if (treatmentPlanItemRecord.status === PlanItemStatus.COMPLETED) {
    throw new AppError('Cannot delete an item that has already been converted to a treatment', 409)
  }

  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      targetId: itemId,
      targetType: TargetType.TREATMENT_PLAN_ITEM,
      action: AuditAction.TREATMENT_PLAN_ITEM_CANCELLED,
      metadata: { treatmentPlanId: treatmentPlanItemRecord.treatmentPlanId, procedure: treatmentPlanItemRecord.procedure },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    await deleteTreatmentPlanItemById(treatmentPlanItemRecord.id, tx)
  })
}