import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as treatmentPlanRepository from '../repositories/treatmentPlan.repository.js';
import * as treatmentPlanItemRepository from '../repositories/treatmentPlanItem.repository.js';
import * as procedureCatalogRepository from '../repositories/procedureCatalog.repository.js';
import { TargetType, TreatmentPlanStatus, PlanItemStatus, AuditAction } from '@prisma/client';
const CLOSED_PLAN_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]

export const createTreatmentPlanItemService = async ({ treatmentPlanId, procedureCatalogId, procedure, toothNumber, estimatedAmount }, actor) => {
  const treatmentPlanRecord = await treatmentPlanRepository.findTreatmentPlanById(treatmentPlanId)
  if (!treatmentPlanRecord) {
    throw new appError.AppError('Treatment plan not found', 404)
  }
  if (CLOSED_PLAN_STATUSES.includes(treatmentPlanRecord.status)) {
    throw new appError.AppError('Cannot add items to a completed or cancelled plan', 409)
  }

  if (procedureCatalogId) {
    const catalogEntry = await procedureCatalogRepository.findProcedureById(procedureCatalogId)
    if (!catalogEntry) {
      throw new appError.AppError('Procedure not found', 404)
    }
  }

  if (!procedure?.trim()) {
    throw new appError.AppError('Procedure is required', 400)
  }
  const parsedAmount = parseFloat(estimatedAmount)
  if (!estimatedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new appError.AppError('A valid estimated amount is required', 400)
  }
  const parsedTooth = toothNumber !== undefined && toothNumber !== null
    ? parseInt(toothNumber)
    : null
  if (parsedTooth !== null && (isNaN(parsedTooth) || parsedTooth < 1 || parsedTooth > 32)) {
    throw new appError.AppError('Invalid tooth number', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const created = await treatmentPlanItemRepository.createTreatmentPlanItem({
      treatmentPlanId: treatmentPlanRecord.id,
      procedureCatalogId: procedureCatalogId || null,
      procedure: procedure.trim(),
      toothNumber: parsedTooth,
      estimatedAmount: parsedAmount,
      status: PlanItemStatus.PROPOSED
    }, tx)

    await auditRepository.createAuditLog({
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

export const editTreatmentPlanItemService = async ({ itemId, procedure, toothNumber, estimatedAmount }, actor) => {
  const treatmentPlanItemRecord = await treatmentPlanItemRepository.findTreatmentPlanItemById(itemId)
  if (!treatmentPlanItemRecord) {
    throw new appError.AppError('Treatment plan item not found', 404)
  }
  if (treatmentPlanItemRecord.status === PlanItemStatus.COMPLETED) {
    throw new appError.AppError('Cannot edit an item that has already been converted to a treatment', 409)
  }

  const updates = {}

  if (procedure !== undefined) {
    if (!procedure?.trim()) {
      throw new appError.AppError('Procedure is required', 400)
    }
    updates.procedure = procedure.trim()
  }

  if (estimatedAmount !== undefined) {
    const parsedAmount = parseFloat(estimatedAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new appError.AppError('A valid estimated amount is required', 400)
    }
    updates.estimatedAmount = parsedAmount
  }

  if (toothNumber !== undefined) {
    const parsedTooth = toothNumber === null ? null : parseInt(toothNumber)
    if (parsedTooth !== null && (isNaN(parsedTooth) || parsedTooth < 1 || parsedTooth > 32)) {
      throw new appError.AppError('Invalid tooth number', 400)
    }
    updates.toothNumber = parsedTooth
  }

  if (Object.keys(updates).length === 0) {
    throw new appError.AppError('No valid fields provided', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const updated = await treatmentPlanItemRepository.updateTreatmentPlanItemById(itemId, updates, tx)

    await auditRepository.createAuditLog({
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

export const relocateTreatmentPlanItemService = async ({ itemId, treatmentPlanId }, actor) => {
  const [treatmentPlanItemRecord, treatmentPlanRecord] = await Promise.all([
    treatmentPlanItemRepository.findTreatmentPlanItemById(itemId),
    treatmentPlanRepository.findTreatmentPlanById(treatmentPlanId)
  ])

  if (!treatmentPlanRecord) {
    throw new appError.AppError('Treatment plan not found', 404)
  }
  if (!treatmentPlanItemRecord) {
    throw new appError.AppError('Treatment plan item not found', 404)
  }
  if (treatmentPlanItemRecord.status === PlanItemStatus.COMPLETED) {
    throw new appError.AppError('Cannot relocate an item that has already been converted to a treatment', 409)
  }
  if (CLOSED_PLAN_STATUSES.includes(treatmentPlanRecord.status)) {
    throw new appError.AppError('Cannot relocate an item to a completed or cancelled plan', 409)
  }
  // Assumes treatmentPlanItemRepository.findTreatmentPlanItemById includes { treatmentPlan: { select: { patientId: true } } } —
  // confirm the repo actually returns this before relying on it here.
  if (treatmentPlanItemRecord.treatmentPlan.patientId !== treatmentPlanRecord.patientId) {
    throw new appError.AppError('Target treatment plan does not belong to the same patient', 400)
  }

  const fromPlanId = treatmentPlanItemRecord.treatmentPlanId

  return prismaConfig.prisma.$transaction(async (tx) => {
    const updated = await treatmentPlanItemRepository.updateTreatmentPlanItemById(itemId, {
      treatmentPlanId: treatmentPlanRecord.id
    }, tx)

    await auditRepository.createAuditLog({
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

export const removeTreatmentPlanItemService = async ({ itemId }, actor) => {
  const treatmentPlanItemRecord = await treatmentPlanItemRepository.findTreatmentPlanItemById(itemId)
  if (!treatmentPlanItemRecord) {
    throw new appError.AppError('Treatment plan item not found', 404)
  }
  if (treatmentPlanItemRecord.status === PlanItemStatus.COMPLETED) {
    throw new appError.AppError('Cannot delete an item that has already been converted to a treatment', 409)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: itemId,
      targetType: TargetType.TREATMENT_PLAN_ITEM,
      action: AuditAction.TREATMENT_PLAN_ITEM_CANCELLED,
      metadata: { treatmentPlanId: treatmentPlanItemRecord.treatmentPlanId, procedure: treatmentPlanItemRecord.procedure },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    await treatmentPlanItemRepository.deleteTreatmentPlanItemById(treatmentPlanItemRecord.id, tx)
  })
}