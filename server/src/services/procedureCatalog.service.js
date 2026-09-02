// server/src/services/procedureCatalogService.js
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as procedureCatalogRepository from '../repositories/procedureCatalog.repository.js';
import { TargetType, AuditAction } from '@prisma/client';
export const getAllProceduresService = async ({ take = 20, skip = 0, search, category, active }) => {
  return await procedureCatalogRepository.findAllProcedures({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    search: search?.trim() || undefined,
    category: category?.trim() || undefined,
    active: active !== undefined ? active === 'true' : undefined
  })
}

export const getProcedureService = async (id) => {
  const procedure = await procedureCatalogRepository.findProcedureById(id)
  if (!procedure) {
    throw new appError.AppError('Procedure not found', 404)
  }
  return procedure
}

export const createProcedureService = async ({ code, name, category, defaultAmount }, actor) => {
  if (!name?.trim()) {
    throw new appError.AppError('Name is required', 400)
  }
  const parsedAmount = parseFloat(defaultAmount)
  if (!defaultAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new appError.AppError('A valid default amount is required', 400)
  }

  const trimmedCode = code?.trim() || null
  if (trimmedCode) {
    const existing = await procedureCatalogRepository.findProcedureByCode(trimmedCode)
    if (existing) {
      throw new appError.AppError('A procedure with this code already exists', 409)
    }
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const created = await procedureCatalogRepository.createProcedure({
      code: trimmedCode,
      name: name.trim(),
      category: category?.trim() || null,
      defaultAmount: parsedAmount,
      active: true,
      createdById: actor.id
    }, tx)

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.PROCEDURE_CATALOG,
      action: AuditAction.PROCEDURE_CREATED,
      metadata: { name: created.name, code: created.code, defaultAmount: created.defaultAmount },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })
}

export const updateProcedureService = async (id, body, actor) => {
  const procedure = await procedureCatalogRepository.findProcedureById(id)
  if (!procedure) {
    throw new appError.AppError('Procedure not found', 404)
  }

  const allowedFields = ['name', 'category', 'defaultAmount', 'code']
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'defaultAmount') {
        const parsedAmount = parseFloat(body[field])
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          throw new appError.AppError('A valid default amount is required', 400)
        }
        updates[field] = parsedAmount
      } else if (field === 'name') {
        if (!body.name?.trim()) {
          throw new appError.AppError('Name is required', 400)
        }
        updates.name = body.name.trim()
      } else {
        updates[field] = body[field]?.trim() || null
      }
    }
  }

  if (updates.code) {
    const existing = await procedureCatalogRepository.findProcedureByCode(updates.code)
    if (existing && existing.id !== id) {
      throw new appError.AppError('A procedure with this code already exists', 409)
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new appError.AppError('No valid fields provided', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const updated = await procedureCatalogRepository.updateProcedureById(id, updates, tx)

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.PROCEDURE_CATALOG,
      action: AuditAction.PROCEDURE_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return updated
  })
}

export const deactivateProcedureService = async (id, actor) => {
  const procedure = await procedureCatalogRepository.findProcedureById(id)
  if (!procedure) {
    throw new appError.AppError('Procedure not found', 404)
  }
  if (!procedure.active) {
    throw new appError.AppError('This procedure is already inactive', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const updated = await procedureCatalogRepository.updateProcedureById(id, { active: false }, tx)

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.PROCEDURE_CATALOG,
      action: AuditAction.PROCEDURE_DEACTIVATED,
      metadata: { name: procedure.name },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return updated
  })
}

export const reactivateProcedureService = async (id, actor) => {
  const procedure = await procedureCatalogRepository.findProcedureById(id)
  if (!procedure) {
    throw new appError.AppError('Procedure not found', 404)
  }
  if (procedure.active) {
    throw new appError.AppError('This procedure is already active', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const updated = await procedureCatalogRepository.updateProcedureById(id, { active: true }, tx)

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.PROCEDURE_CATALOG,
      action: AuditAction.PROCEDURE_REACTIVATED,
      metadata: { name: procedure.name },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return updated
  })
}