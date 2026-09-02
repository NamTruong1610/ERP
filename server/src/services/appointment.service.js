import * as appointmentRepository from '../repositories/appointment.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as patientRepository from '../repositories/patient.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as statsRepository from '../repositories/stats.repository.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { TargetType, UserStatus, AuditAction, AppointmentStatus } from '@prisma/client';

const VALID_STATUSES = Object.values(AppointmentStatus)

export const getAllAppointmentsService = async ({ take, skip, search, from, to }) => {

  const result = await appointmentRepository.findAllAppointments({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    search: search?.trim() || undefined,
    from,
    to
  })
  return result
}

export const getAppointmentService = async (id) => {
  const appointment = await appointmentRepository.findAppointmentById(id)
  if (!appointment) {
    throw new appError.AppError('Appointment not found', 404)
  }
  return appointment

}

export const getMyAppointmentsService = async (id) => {
  const appointments = await appointmentRepository.findAppointmentsByDentist(id)
  return appointments
}

export const getAppointmentsByPatientService = async (patientId) => {
  const patient = await patientRepository.findPatientById(patientId)
  if (!patient) {
    throw new appError.AppError('Patient not found', 404)
  }

  const appointments = await appointmentRepository.findAppointmentsByPatient(patientId)
  return appointments
}

export const createAppointmentService = async ({ dentistId, patientId, date, notes }, actor) => {

  if (!patientId || !date) {
    throw new appError.AppError('Patient and date are required', 400)
  }

  // Validate patient exists
  const patient = await patientRepository.findPatientById(patientId)
  if (!patient) {
    throw new appError.AppError('Patient not found', 404)
  }

  // Only validate dentist if one is provided
  if (dentistId) {
    const dentist = await userRepository.findUserById(dentistId)
    if (!dentist || dentist.status !== UserStatus.ACTIVE) {
      throw new appError.AppError('Dentist not found', 404)
    }
  }

  const appointment = await prismaConfig.prisma.$transaction(async (tx) => {
    const created = await appointmentRepository.createAppointment({
      patientId,
      date: new Date(date),
      notes,
      ...(dentistId && { dentistId })
    }, tx)

    await auditRepository.createAuditLog({
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
    statsRepository.invalidateClinicStats(),
    statsRepository.invalidateMyStats(actor.id)
  ])

  return appointment
}

export const updateAppointmentService = async (id, body, actor) => {
  const appointment = await appointmentRepository.findAppointmentById(id)
  if (!appointment) {
    throw new appError.AppError('Appointment not found', 404)
  }

  if (appointment.status === AppointmentStatus.COMPLETED) {
    throw new appError.AppError('Cannot edit a completed appointment', 409)
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
    throw new appError.AppError('No valid fields provided', 400)
  }

  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    throw new appError.AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400)
  }

  if (updates.status === AppointmentStatus.COMPLETED) {
    throw new appError.AppError('Appointment status is set to COMPLETED automatically when its visit is completed', 400)
  }

  if (updates.dentistId !== undefined && updates.dentistId !== null) {
    const dentist = await userRepository.findUserById(updates.dentistId)
    if (!dentist || dentist.status !== UserStatus.ACTIVE) {
      throw new appError.AppError('Dentist not found', 404)
    }
  }

  const isCancellation = updates.status === 'CANCELLED' && appointment.status !== 'CANCELLED'

  const updated = await prismaConfig.prisma.$transaction(async (tx) => {
    const result = await appointmentRepository.updateAppointment(id, updates, tx)
    await auditRepository.createAuditLog({
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

export const deleteAppointmentService = async (id, actor) => {
  const appointment = await appointmentRepository.findAppointmentById(id)
  if (!appointment) {
    throw new appError.AppError('Appointment not found', 404)
  }
  if (appointment.visit) {
    throw new appError.AppError('Cannot delete an appointment that has a visit — delete the visit first', 409)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.APPOINTMENT,
      action: AuditAction.APPOINTMENT_DELETED,
      metadata: { patientId: appointment.patientId },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await appointmentRepository.softDeleteAppointment(id, tx)
  })
}