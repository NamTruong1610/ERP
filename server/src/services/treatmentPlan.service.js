import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as patientRepository from '../repositories/patient.repository.js';
import * as treatmentRepository from '../repositories/treatment.repository.js';
import * as treatmentPlanRepository from '../repositories/treatmentPlan.repository.js';
import * as treatmentPlanItemRepository from '../repositories/treatmentPlanItem.repository.js';
import * as procedureCatalogRepository from '../repositories/procedureCatalog.repository.js';
import { TargetType, TreatmentPlanStatus, AuditAction, PlanItemStatus } from '@prisma/client';
const CLOSED_PLAN_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]
const TERMINAL_STATUSES = [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]
const VALID_STATUS_TARGETS = [TreatmentPlanStatus.ACTIVE, TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED]

export const getAllTreatmentPlansService = async ({ take = 20, skip = 0, patientId }) => {
  return await treatmentPlanRepository.findAllTreatmentPlans({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    patientId
  })
}

export const getTreatmentPlanService = async (id) => {
  const treatmentPlan = await treatmentPlanRepository.findTreatmentPlanById(id)
  if (!treatmentPlan) {
    throw new appError.AppError('Treatment plan not found', 404)
  }
  return treatmentPlan
}

// Creates just the plan shell — patientId, title, notes. Items and treatments
// are attached afterward via addTreatmentPlanItemsBulkService /
// attachTreatmentsToTreatmentPlanService, deliberately kept separate so
// creation stays a single, cheap, transaction-light operation.
export const createTreatmentPlanService = async ({ patientId, title, notes }, actor) => {
  if (!patientId) {
    throw new appError.AppError('Patient is required', 400)
  }
  if (!title?.trim()) {
    throw new appError.AppError('Title is required', 400)
  }

  const patientRecord = await patientRepository.findPatientById(patientId)
  if (!patientRecord) {
    throw new appError.AppError('Patient not found', 404)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const created = await treatmentPlanRepository.createTreatmentPlan({
      patientId,
      createdById: actor.id,
      title: title.trim(),
      notes: notes?.trim() || null,
      status: TreatmentPlanStatus.PROPOSED
    }, tx)

    await auditRepository.createAuditLog({
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

export const addTreatmentPlanItemsBulkService = async (planId, { items }, actor) => {
  const plan = await treatmentPlanRepository.findTreatmentPlanById(planId)
  if (!plan) {
    throw new appError.AppError('Treatment plan not found', 404)
  }
  if (CLOSED_PLAN_STATUSES.includes(plan.status)) {
    throw new appError.AppError('Cannot add items to a completed or cancelled plan', 409)
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new appError.AppError('At least one item is required', 400)
  }

  const catalogIds = [...new Set(items.map(i => i.procedureCatalogId).filter(Boolean))]
  if (catalogIds.length) {
    const found = await procedureCatalogRepository.findProceduresByIds(catalogIds)
    if (found.length !== catalogIds.length) {
      throw new appError.AppError('One or more procedures not found', 404)
    }
  }

  const parsed = items.map((item, i) => {
    if (!item.procedure?.trim()) {
      throw new appError.AppError(`Item ${i + 1}: procedure is required`, 400)
    }
    const estimatedAmount = parseFloat(item.estimatedAmount)
    if (!item.estimatedAmount || isNaN(estimatedAmount) || estimatedAmount <= 0) {
      throw new appError.AppError(`Item ${i + 1}: a valid estimated amount is required`, 400)
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

  return prismaConfig.prisma.$transaction(async (tx) => {
    const created = await treatmentPlanItemRepository.createTreatmentPlanItemsBulk(parsed, tx)

    await auditRepository.createAuditLog({
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

export const attachTreatmentsToTreatmentPlanService = async (treatmentPlanId, treatmentIds, actor) => {
  if (!Array.isArray(treatmentIds) || treatmentIds.length === 0) {
    throw new appError.AppError('At least one treatment is required', 400)
  }

  const treatmentPlanRecord = await treatmentPlanRepository.findTreatmentPlanById(treatmentPlanId)
  if (!treatmentPlanRecord) {
    throw new appError.AppError('Treatment plan not found', 404)
  }
  if (CLOSED_PLAN_STATUSES.includes(treatmentPlanRecord.status)) {
    throw new appError.AppError('Cannot attach treatments to a completed or cancelled plan', 409)
  }

  const treatments = await treatmentRepository.findTreatmentsByIds(treatmentIds)
  if (treatments.length !== treatmentIds.length) {
    throw new appError.AppError('One or more treatments not found', 404)
  }
  for (const t of treatments) {
    if (t.visit.patientId !== treatmentPlanRecord.patientId) {
      throw new appError.AppError('One or more treatments do not belong to this patient', 400)
    }
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    await treatmentPlanRepository.attachTreatmentsToPlan(treatmentPlanId, treatmentIds, tx)

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: treatmentPlanId,
      targetType: TargetType.TREATMENT_PLAN,
      action: AuditAction.TREATMENT_PLAN_UPDATED,
      metadata: { attachedTreatmentIds: treatmentIds },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return treatmentPlanRepository.findTreatmentPlanById(treatmentPlanId, tx)
  })
}

export const updateTreatmentPlanService = async (id, body, actor) => {
  const plan = await treatmentPlanRepository.findTreatmentPlanById(id)
  if (!plan) {
    throw new appError.AppError('Treatment plan not found', 404)
  }

  const updates = {}

  // title/notes stay editable for the plan's entire life, regardless of
  // status — unlike Visit, where every field locks once terminal. A plan's
  // title/notes carry no patient-facing "quote" weight the way
  // TreatmentPlanItem.estimatedAmount does, so there's nothing here worth
  // freezing.
  if (body.title !== undefined) {
    if (!body.title?.trim()) {
      throw new appError.AppError('Title is required', 400)
    }
    updates.title = body.title.trim()
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes?.trim() || null
  }

  // Status is the one thing that DOES lock once the plan is terminal.
  if (body.status !== undefined) {
    if (TERMINAL_STATUSES.includes(plan.status)) {
      throw new appError.AppError('Cannot change the status of a completed or cancelled plan', 409)
    }
    if (!VALID_STATUS_TARGETS.includes(body.status)) {
      throw new appError.AppError(`Status must be one of: ${VALID_STATUS_TARGETS.join(', ')}`, 400)
    }
    if (body.status === TreatmentPlanStatus.COMPLETED) {
      const hasOpenItems = plan.treatmentPlanItems.some(i => i.status === PlanItemStatus.PROPOSED)
      if (hasOpenItems) {
        throw new appError.AppError('Cannot complete a plan while it still has proposed items — resolve or cancel them first', 409)
      }
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    throw new appError.AppError('No valid fields provided', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    await treatmentPlanRepository.updateTreatmentPlanById(id, updates, tx)

    // Cancelling cascades to any still-PROPOSED items — a proposal sitting
    // under a cancelled plan is a contradiction. COMPLETED items and any
    // already-attached Treatment records are untouched — they're historical
    // fact, independent of the plan's own outcome.
    if (updates.status === TreatmentPlanStatus.CANCELLED) {
      await treatmentPlanRepository.cancelProposedItemsByPlanId(id, tx)
    }

    await auditRepository.createAuditLog({
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
    return updates.status ? await treatmentPlanRepository.findTreatmentPlanById(id, tx) : await treatmentPlanRepository.findTreatmentPlanById(id, tx)
  })
}