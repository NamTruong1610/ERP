const { VisitStatus, AppointmentStatus, VisitProviderRole, AuditAction, TargetType, UserStatus } = require('@prisma/client')
const { prisma } = require('../config/PrismaConfig')
const { AppError } = require('../lib/AppError')
const { createAuditLog } = require('../repositories/auditRepository')
const { findPatientById } = require('../repositories/patientRepository')
const { findUserById } = require('../repositories/userRepository')
const { findAppointmentById, updateAppointment } = require('../repositories/appointmentRepository')
const { softDeleteTreatment } = require('../repositories/treatmentRepository')
const {
  findAllVisits,
  findVisitById,
  findVisitByAppointmentId,
  createVisit,
  updateVisitById,
  softDeleteVisit,
  findVisitProviderById,
  addVisitProvider,
  updateVisitProviderById,
  removeVisitProvider,
  countVisitProvidersByVisitId
} = require('../repositories/visitRepository')

const VALID_STATUSES = [VisitStatus.IN_PROGRESS, VisitStatus.COMPLETED, VisitStatus.CANCELLED]
const TERMINAL_STATUSES = [VisitStatus.COMPLETED, VisitStatus.CANCELLED]

exports.getAllVisitsService = async ({ take = 20, skip = 0, patientId }) => {
  return await findAllVisits({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    patientId
  })
}

exports.getVisitService = async (id) => {
  const visit = await findVisitById(id)
  if (!visit) {
    throw new AppError('Visit not found', 404)
  }
  return visit
}

// Validates + creates the VisitProvider rows for a new visit, inside the caller's transaction. Not exported — internal helper shared by both creation paths below.
const buildProviders = async (providers) => {
  if (!providers || providers.length === 0) return []

  const seen = new Set()
  for (const p of providers) {
    if (!p.performerId || !p.role) {
      throw new AppError('Each provider requires a performerId and role', 400)
    }
    if (!Object.values(VisitProviderRole).includes(p.role)) {
      throw new AppError(`Invalid provider role: ${p.role}`, 400)
    }
    if (seen.has(p.performerId)) {
      throw new AppError('The same provider was listed more than once', 400)
    }
    seen.add(p.performerId)

    const user = await findUserById(p.performerId)
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AppError(`Provider ${p.performerId} not found`, 404)
    }
  }
  return providers
}

// Path 1: an appointment already exists and is being turned into a visit (the normal case — patient shows up for their booking).
exports.createVisitFromAppointmentService = async ({ appointmentId, visitDate, notes, providers }, actor) => {
  const appointment = await findAppointmentById(appointmentId)
  if (!appointment) {
    throw new AppError('Appointment not found', 404)
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    throw new AppError('Cannot start a visit from a cancelled appointment', 400)
  }

  const existingVisit = await findVisitByAppointmentId(appointmentId)
  if (existingVisit) {
    throw new AppError('A visit already exists for this appointment', 409)
  }

  // Defaults to the appointment's own dentist as PRIMARY if no explicit provider list was given — covers the common single-provider case without forcing the caller to repeat data that's already on the booking.
  const resolvedProviders = providers?.length
    ? await buildProviders(providers)
    : appointment.dentistId
      ? await buildProviders([{ performerId: appointment.dentistId, role: VisitProviderRole.PRIMARY }])
      : []

  return prisma.$transaction(async (tx) => {
    const visit = await createVisit({
      patientId: appointment.patientId,
      appointmentId,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      status: VisitStatus.IN_PROGRESS,
      notes: notes?.trim() || null
    }, tx)

    for (const p of resolvedProviders) {
      await addVisitProvider({ visitId: visit.id, performerId: p.performerId, role: p.role }, tx)
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: visit.id,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_CREATED,
      metadata: { appointmentId, patientId: appointment.patientId, providerCount: resolvedProviders.length },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return findVisitById(visit.id, tx)
  })
}

// Path 2: a walk-in — no prior appointment.
exports.createWalkInVisitService = async ({ patientId, visitDate, notes, providers }, actor) => {
  if (!patientId) {
    throw new AppError('Patient is required', 400)
  }

  const patient = await findPatientById(patientId)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }

  const resolvedProviders = await buildProviders(providers)

  return prisma.$transaction(async (tx) => {
    const visit = await createVisit({
      patientId,
      appointmentId: null,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      status: VisitStatus.IN_PROGRESS,
      notes: notes?.trim() || null
    }, tx)

    for (const p of resolvedProviders) {
      await addVisitProvider({ visitId: visit.id, performerId: p.performerId, role: p.role }, tx)
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: visit.id,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_CREATED,
      metadata: { patientId, walkIn: true, providerCount: resolvedProviders.length },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return findVisitById(visit.id, tx)
  })
}

exports.updateVisitService = async (id, { notes, status }, actor) => {
  const visit = await findVisitById(id)
  if (!visit) {
    throw new AppError('Visit not found', 404)
  }
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new AppError('Cannot edit a completed or cancelled visit', 409)
  }

  const updates = {}
  if (notes !== undefined) {
    updates.notes = notes?.trim() || null
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError('Invalid status', 400)
    }
    if (status === VisitStatus.IN_PROGRESS) {
      throw new AppError('Cannot move a visit back to in-progress', 400)
    }
    updates.status = status
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateVisitById(id, updates, tx)

    // Completing a visit auto-completes its appointment (if any) — this is
    // the side effect that used to live on Treatment creation, moved here
    // per the earlier design decision.
    if (updates.status === VisitStatus.COMPLETED && visit.appointmentId) {
      await updateAppointment(visit.appointmentId, { status: AppointmentStatus.COMPLETED }, tx)
    }

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.VISIT,
      action: updates.status === VisitStatus.CANCELLED ? AuditAction.VISIT_CANCELLED : AuditAction.VISIT_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return updated
  })
}

exports.addVisitProviderService = async (visitId, { performerId, role }, actor) => {
  const visit = await findVisitById(visitId)
  if (!visit) {
    throw new AppError('Visit not found', 404)
  }
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new AppError('Cannot add a provider to a completed or cancelled visit', 409)
  }
  await buildProviders([{ performerId, role }])

  if (visit.visitProviders.some(vp => vp.performerId === performerId)) {
    throw new AppError('This provider is already on the visit', 409)
  }

  return prisma.$transaction(async (tx) => {
    const provider = await addVisitProvider({ visitId, performerId, role }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: visitId,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_PROVIDER_ADDED,
      metadata: { performerId, role },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return provider
  })
}

exports.editVisitProviderRoleService = async (visitId, providerId, { role }, actor) => {
  const provider = await findVisitProviderById(providerId)
  if (!provider || provider.visit.id !== visitId) {
    throw new AppError('Visit provider not found', 404)
  }

  const visit = await findVisitById(visitId)
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new AppError('Cannot edit a provider on a completed or cancelled visit', 409)
  }

  if (!role || !Object.values(VisitProviderRole).includes(role)) {
    throw new AppError('Invalid provider role', 400)
  }
  if (role === provider.role) {
    throw new AppError('No change — provider already has this role', 400)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateVisitProviderById(providerId, { role }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: visitId,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_PROVIDER_UPDATED,
      metadata: { performerId: provider.performerId, fromRole: provider.role, toRole: role },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return updated
  })
}

exports.removeVisitProviderService = async (visitId, providerId, actor) => {
  const provider = await findVisitProviderById(providerId)
  if (!provider || provider.visit.id !== visitId) {
    throw new AppError('Visit provider not found', 404)
  }
  const visit = await findVisitById(visitId)
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new AppError('Cannot remove a provider from a completed or cancelled visit', 409)
  }

  const count = await countVisitProvidersByVisitId(visitId)
  if (count <= 1) {
    throw new AppError('Cannot remove the last provider on a visit', 409)
  }

  return prisma.$transaction(async (tx) => {
    await removeVisitProvider(providerId, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: visitId,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_PROVIDER_REMOVED,
      metadata: { performerId: provider.performerId, role: provider.role },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })
}

exports.deleteVisitService = async (id, { confirm } = {}, actor) => {
  const visit = await findVisitById(id)
  if (!visit) {
    throw new AppError('Visit not found', 404)
  }

  const billedTreatment = visit.treatments.find(t => t.invoiceItem != null)
  if (billedTreatment) {
    throw new AppError('Cannot delete a visit with a treatment that has already been invoiced', 409)
  }

  if (visit.treatments.length > 0 && !confirm) {
    throw new AppError(
      `This visit has ${visit.treatments.length} treatment(s) that will also be deleted. Resend with confirm: true to proceed.`,
      409
    )
  }

  await prisma.$transaction(async (tx) => {
    for (const treatment of visit.treatments) {
      await softDeleteTreatment(treatment.id, tx)
    }
    await softDeleteVisit(id, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_DELETED,
      metadata: { cascadedTreatmentIds: visit.treatments.map(t => t.id) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
  })
}