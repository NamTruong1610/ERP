const {
  findAllAppointments,
  findAppointmentById,
  findAppointmentsByDentist,
  findAppointmentsByPatient,
  createAppointment,
  updateAppointment,
  softDeleteAppointment
} = require('../repository/appointmentRepository')

const { findUserById } = require('../repository/userRepository')
const { findPatientById } = require('../repository/patientRepository')
const { createAuditLog } = require('../repository/auditRepository')
const { invalidateClinicStats, invalidateMyStats } = require('../repository/statsRepository')

const { prisma } = require('../config/PrismaConfig')
const { UserStatus, AuditAction, TargetType } = require('@prisma/client')

const VALID_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED']

const { AppError } = require('../utils/errorsUtil.js');

exports.getAllAppointmentsService = async ({ take, skip, search, from, to }) => {

  const result = await findAllAppointments({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    search: search?.trim() || undefined,
    from,
    to
  })
  return result
}

exports.getAppointmentService = async (id) => {
  const appointment = await findAppointmentById(id)
  if (!appointment) {
    throw new AppError('Appointment not found', 404)
  }
  return appointment

}

exports.getMyAppointmentsService = async (id) => {
  const appointments = await findAppointmentsByDentist(id)
  return appointments
}

exports.getAppointmentsByPatientService = async (patientId) => {
  const patient = await findPatientById(patientId)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }

  const appointments = await findAppointmentsByPatient(patientId)
  return appointments
}

exports.createAppointmentService = async ({ dentistId, patientId, date, notes }, actor) => {

  if (!patientId || !date) {
    throw new AppError('Patient and date are required', 400)
  }

  // Validate patient exists
  const patient = await findPatientById(patientId)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }

  // Only validate dentist if one is provided
  if (dentistId) {
    const dentist = await findUserById(dentistId)
    if (!dentist || dentist.status !== UserStatus.ACTIVE) {
      throw new AppError('Dentist not found', 404)
    }
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const created = await createAppointment({
      patientId,
      date: new Date(date),
      notes,
      ...(dentistId && { dentistId })
    }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.APPOINTMENT,
      action: AuditAction.APPOINTMENT_CREATED,
      metadata: { patientId, dentistId: dentistId ?? null, date: created.date },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })

  await Promise.all([
    invalidateClinicStats(),
    invalidateMyStats(actor.id)
  ])

  return appointment
}

exports.updateAppointmentService = async (id, body, actor) => {
  const appointment = await findAppointmentById(id)
  if (!appointment) {
    throw new AppError('Appointment not found', 404)
  }

  const allowedFields = ['date', 'status', 'notes', 'dentistId']
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'date') {
        updates[field] = new Date(body[field])
      } else if (field === 'dentistId') {
        updates[field] = body[field] || null  // convert empty string to null
      } else {
        updates[field] = body[field]
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400)
  }

  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400)
  }

  if (updates.dentistId !== undefined && updates.dentistId !== null) {
    const dentist = await findUserById(updates.dentistId)
    if (!dentist || dentist.status !== UserStatus.ACTIVE) {
      throw new AppError('Dentist not found', 404)
    }
  }

  const isCancellation = updates.status === 'CANCELLED' && appointment.status !== 'CANCELLED'

  const updated = await prisma.$transaction(async (tx) => {
    const result = await updateAppointment(id, updates, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.APPOINTMENT,
      action: isCancellation ? AuditAction.APPOINTMENT_CANCELLED : AuditAction.APPOINTMENT_UPDATED,
      metadata: isCancellation
        ? { previousStatus: appointment.status }
        : { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    return result
  })

  return updated
}

exports.deleteAppointmentService = async (id, actor) => {
  const appointment = await findAppointmentById(id)
  if (!appointment) {
    throw new AppError('Appointment not found', 404)
  }

  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.APPOINTMENT,
      action: AuditAction.APPOINTMENT_DELETED,
      metadata: { patientId: appointment.patientId },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await softDeleteAppointment(id, tx)
  })
}