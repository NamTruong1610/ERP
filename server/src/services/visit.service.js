import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as patientRepository from '../repositories/patient.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as appointmentRepository from '../repositories/appointment.repository.js';
import * as treatmentRepository from '../repositories/treatment.repository.js';
import * as visitRepository from '../repositories/visit.repository.js';
import { UserStatus, VisitStatus, VisitProviderRole, AppointmentStatus, TargetType, AuditAction } from '@prisma/client';
const VALID_STATUSES = [VisitStatus.IN_PROGRESS, VisitStatus.COMPLETED, VisitStatus.CANCELLED]
const TERMINAL_STATUSES = [VisitStatus.COMPLETED, VisitStatus.CANCELLED]

export const getAllVisitsService = async ({ take = 20, skip = 0, patientId }) => {
  return await visitRepository.findAllVisits({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    patientId
  })
}

export const getVisitService = async (id) => {
  const visit = await visitRepository.findVisitById(id)
  if (!visit) {
    throw new appError.AppError('Visit not found', 404)
  }
  return visit
}

// Validates + creates the VisitProvider rows for a new visit, inside the caller's transaction. Not exported — internal helper shared by both creation paths below.
const buildProviders = async (providers) => {
  if (!providers || providers.length === 0) return []

  const seen = new Set()
  for (const p of providers) {
    if (!p.performerId || !p.role) {
      throw new appError.AppError('Each provider requires a performerId and role', 400)
    }
    if (!Object.values(VisitProviderRole).includes(p.role)) {
      throw new appError.AppError(`Invalid provider role: ${p.role}`, 400)
    }
    if (seen.has(p.performerId)) {
      throw new appError.AppError('The same provider was listed more than once', 400)
    }
    seen.add(p.performerId)

    const user = await userRepository.findUserById(p.performerId)
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new appError.AppError(`Provider ${p.performerId} not found`, 404)
    }
  }
  return providers
}

// Path 1: an appointment already exists and is being turned into a visit (the normal case — patient shows up for their booking).
export const createVisitFromAppointmentService = async ({ appointmentId, visitDate, notes, providers }, actor) => {
  const appointment = await appointmentRepository.findAppointmentById(appointmentId)
  if (!appointment) {
    throw new appError.AppError('Appointment not found', 404)
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    throw new appError.AppError('Cannot start a visit from a cancelled appointment', 400)
  }

  const existingVisit = await visitRepository.findVisitByAppointmentId(appointmentId)
  if (existingVisit) {
    throw new appError.AppError('A visit already exists for this appointment', 409)
  }

  // Defaults to the appointment's own dentist as PRIMARY if no explicit provider list was given — covers the common single-provider case without forcing the caller to repeat data that's already on the booking.
  const resolvedProviders = providers?.length
    ? await buildProviders(providers)
    : appointment.dentistId
      ? await buildProviders([{ performerId: appointment.dentistId, role: VisitProviderRole.PRIMARY }])
      : []

  return prismaConfig.prisma.$transaction(async (tx) => {
    const visit = await visitRepository.createVisit({
      patientId: appointment.patientId,
      appointmentId,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      status: VisitStatus.IN_PROGRESS,
      notes: notes?.trim() || null
    }, tx)

    for (const p of resolvedProviders) {
      await visitRepository.addVisitProvider({ visitId: visit.id, performerId: p.performerId, role: p.role }, tx)
    }

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: visit.id,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_CREATED,
      metadata: { appointmentId, patientId: appointment.patientId, providerCount: resolvedProviders.length },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return visitRepository.findVisitById(visit.id, tx)
  })
}

// Path 2: a walk-in — no prior appointment.
export const createWalkInVisitService = async ({ patientId, visitDate, notes, providers }, actor) => {
  if (!patientId) {
    throw new appError.AppError('Patient is required', 400)
  }

  const patient = await patientRepository.findPatientById(patientId)
  if (!patient) {
    throw new appError.AppError('Patient not found', 404)
  }

  const resolvedProviders = await buildProviders(providers)

  return prismaConfig.prisma.$transaction(async (tx) => {
    const visit = await visitRepository.createVisit({
      patientId,
      appointmentId: null,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      status: VisitStatus.IN_PROGRESS,
      notes: notes?.trim() || null
    }, tx)

    for (const p of resolvedProviders) {
      await visitRepository.addVisitProvider({ visitId: visit.id, performerId: p.performerId, role: p.role }, tx)
    }

    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: visit.id,
      targetType: TargetType.VISIT,
      action: AuditAction.VISIT_CREATED,
      metadata: { patientId, walkIn: true, providerCount: resolvedProviders.length },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return visitRepository.findVisitById(visit.id, tx)
  })
}

export const updateVisitService = async (id, { notes, status }, actor) => {
  const visit = await visitRepository.findVisitById(id)
  if (!visit) {
    throw new appError.AppError('Visit not found', 404)
  }
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new appError.AppError('Cannot edit a completed or cancelled visit', 409)
  }

  const updates = {}
  if (notes !== undefined) {
    updates.notes = notes?.trim() || null
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      throw new appError.AppError('Invalid status', 400)
    }
    if (status === VisitStatus.IN_PROGRESS) {
      throw new appError.AppError('Cannot move a visit back to in-progress', 400)
    }
    updates.status = status
  }

  if (Object.keys(updates).length === 0) {
    throw new appError.AppError('No valid fields provided', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const updated = await visitRepository.updateVisitById(id, updates, tx)

    // Completing a visit auto-completes its appointment (if any) — this is
    // the side effect that used to live on Treatment creation, moved here
    // per the earlier design decision.
    if (updates.status === VisitStatus.COMPLETED && visit.appointmentId) {
      await appointmentRepository.updateAppointment(visit.appointmentId, { status: AppointmentStatus.COMPLETED }, tx)
    }

    await auditRepository.createAuditLog({
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

export const addVisitProviderService = async (visitId, { performerId, role }, actor) => {
  const visit = await visitRepository.findVisitById(visitId)
  if (!visit) {
    throw new appError.AppError('Visit not found', 404)
  }
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new appError.AppError('Cannot add a provider to a completed or cancelled visit', 409)
  }
  await buildProviders([{ performerId, role }])

  if (visit.visitProviders.some(vp => vp.performerId === performerId)) {
    throw new appError.AppError('This provider is already on the visit', 409)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const provider = await visitRepository.addVisitProvider({ visitId, performerId, role }, tx)

    await auditRepository.createAuditLog({
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

export const editVisitProviderRoleService = async (visitId, providerId, { role }, actor) => {
  const provider = await visitRepository.findVisitProviderById(providerId)
  if (!provider || provider.visit.id !== visitId) {
    throw new appError.AppError('Visit provider not found', 404)
  }

  const visit = await visitRepository.findVisitById(visitId)
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new appError.AppError('Cannot edit a provider on a completed or cancelled visit', 409)
  }

  if (!role || !Object.values(VisitProviderRole).includes(role)) {
    throw new appError.AppError('Invalid provider role', 400)
  }
  if (role === provider.role) {
    throw new appError.AppError('No change — provider already has this role', 400)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    const updated = await visitRepository.updateVisitProviderById(providerId, { role }, tx)

    await auditRepository.createAuditLog({
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

export const removeVisitProviderService = async (visitId, providerId, actor) => {
  const provider = await visitRepository.findVisitProviderById(providerId)
  if (!provider || provider.visit.id !== visitId) {
    throw new appError.AppError('Visit provider not found', 404)
  }
  const visit = await visitRepository.findVisitById(visitId)
  if (TERMINAL_STATUSES.includes(visit.status)) {
    throw new appError.AppError('Cannot remove a provider from a completed or cancelled visit', 409)
  }

  const count = await visitRepository.countVisitProvidersByVisitId(visitId)
  if (count <= 1) {
    throw new appError.AppError('Cannot remove the last provider on a visit', 409)
  }

  return prismaConfig.prisma.$transaction(async (tx) => {
    await visitRepository.removeVisitProvider(providerId, tx)

    await auditRepository.createAuditLog({
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

export const deleteVisitService = async (id, { confirm } = {}, actor) => {
  const visit = await visitRepository.findVisitById(id)
  if (!visit) {
    throw new appError.AppError('Visit not found', 404)
  }

  const billedTreatment = visit.treatments.find(t => t.invoiceItem != null)
  if (billedTreatment) {
    throw new appError.AppError('Cannot delete a visit with a treatment that has already been invoiced', 409)
  }

  if (visit.treatments.length > 0 && !confirm) {
    throw new appError.AppError(
      `This visit has ${visit.treatments.length} treatment(s) that will also be deleted. Resend with confirm: true to proceed.`,
      409
    )
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    for (const treatment of visit.treatments) {
      await treatmentRepository.softDeleteTreatment(treatment.id, tx)
    }
    await visitRepository.softDeleteVisit(id, tx)

    await auditRepository.createAuditLog({
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