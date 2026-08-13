// server/src/services/procedureCatalogService.js
const { AuditAction, TargetType } = require('@prisma/client')
const { prisma } = require('../config/PrismaConfig')
const { AppError } = require('../lib/AppError')
const { createAuditLog } = require('../repositories/auditRepository')
const {
  findAllProcedures,
  findProcedureById,
  findProcedureByCode,
  createProcedure,
  updateProcedureById
} = require('../repositories/procedureCatalogRepository')

exports.getAllProceduresService = async ({ take = 20, skip = 0, search, category, active }) => {
  return await findAllProcedures({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    search: search?.trim() || undefined,
    category: category?.trim() || undefined,
    active: active !== undefined ? active === 'true' : undefined
  })
}

exports.getProcedureService = async (id) => {
  const procedure = await findProcedureById(id)
  if (!procedure) {
    throw new AppError('Procedure not found', 404)
  }
  return procedure
}

exports.createProcedureService = async ({ code, name, category, defaultAmount }, actor) => {
  if (!name?.trim()) {
    throw new AppError('Name is required', 400)
  }
  const parsedAmount = parseFloat(defaultAmount)
  if (!defaultAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new AppError('A valid default amount is required', 400)
  }

  const trimmedCode = code?.trim() || null
  if (trimmedCode) {
    const existing = await findProcedureByCode(trimmedCode)
    if (existing) {
      throw new AppError('A procedure with this code already exists', 409)
    }
  }

  return prisma.$transaction(async (tx) => {
    const created = await createProcedure({
      code: trimmedCode,
      name: name.trim(),
      category: category?.trim() || null,
      defaultAmount: parsedAmount,
      active: true,
      createdById: actor.id
    }, tx)

    await createAuditLog({
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

exports.updateProcedureService = async (id, body, actor) => {
  const procedure = await findProcedureById(id)
  if (!procedure) {
    throw new AppError('Procedure not found', 404)
  }

  const allowedFields = ['name', 'category', 'defaultAmount', 'code']
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'defaultAmount') {
        const parsedAmount = parseFloat(body[field])
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          throw new AppError('A valid default amount is required', 400)
        }
        updates[field] = parsedAmount
      } else if (field === 'name') {
        if (!body.name?.trim()) {
          throw new AppError('Name is required', 400)
        }
        updates.name = body.name.trim()
      } else {
        updates[field] = body[field]?.trim() || null
      }
    }
  }

  if (updates.code) {
    const existing = await findProcedureByCode(updates.code)
    if (existing && existing.id !== id) {
      throw new AppError('A procedure with this code already exists', 409)
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateProcedureById(id, updates, tx)

    await createAuditLog({
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

exports.deactivateProcedureService = async (id, actor) => {
  const procedure = await findProcedureById(id)
  if (!procedure) {
    throw new AppError('Procedure not found', 404)
  }
  if (!procedure.active) {
    throw new AppError('This procedure is already inactive', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateProcedureById(id, { active: false }, tx)

    await createAuditLog({
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

exports.reactivateProcedureService = async (id, actor) => {
  const procedure = await findProcedureById(id)
  if (!procedure) {
    throw new AppError('Procedure not found', 404)
  }
  if (procedure.active) {
    throw new AppError('This procedure is already active', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateProcedureById(id, { active: true }, tx)

    await createAuditLog({
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