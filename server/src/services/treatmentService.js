const { findAppointmentById, updateAppointment } = require('../repositories/appointmentRepository')
const {
  findAllTreatments,
  findTreatmentById,
  findTreatmentByAppointmentId,
  findUnbilledTreatmentsByPatient,
  createTreatment,
  updateTreatment,
  softDeleteTreatment
} = require('../repositories/treatmentRepository')
const { findPatientById } = require('../repositories/patientRepository')

const { createAuditLog } = require('../repositories/auditRepository')
const { AppError } = require('../utils/errorsUtil.js');

const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType } = require('@prisma/client')

exports.getAllTreatmentsService = async ({ take = 20, skip = 0 }) => {
  const treatments = await findAllTreatments({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip)
  })
  return treatments
}

exports.getTreatmentService = async (id) => {
  const treatment = await findTreatmentById(id)
  if (!treatment) {
    throw new AppError('Treatment not found', 404)
  }
  return treatment
}

exports.getTreatmentByAppointmentService = async (appointmentId) => {
  const appointment = await findAppointmentById(appointmentId)
  if (!appointment) {
    throw new AppError('Appointment not found', 404)
  }

  const treatment = await findTreatmentByAppointmentId(appointmentId)
  if (!treatment) {
    throw new AppError('No treatment found for this appointment', 404)
  }

  return treatment
}

exports.getUnbilledTreatmentsService = async (patientId) => {
  const patient = await findPatientById(patientId)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }

  const treatments = await findUnbilledTreatmentsByPatient(patientId)
  return treatments
}

exports.createTreatmentService = async ({ appointmentId, procedure, toothNumber, notes, amount }, actor) => {
  if (!appointmentId || !procedure || amount === undefined) {
    throw new AppError('Appointment, procedure and amount are required', 400)
  }

  // Validate appointment exists
  const appointment = await findAppointmentById(appointmentId)
  if (!appointment) {
    throw new AppError('Appointment not found', 404)
  }

  // Check appointment is not cancelled
  if (appointment.status === 'CANCELLED') {
    throw new AppError('Cannot add treatment to a cancelled appointment', 400)
  }

  // Check treatment doesn't already exist for this appointment
  const existing = await findTreatmentByAppointmentId(appointmentId)
  if (existing) {
    throw new AppError('Treatment already exists for this appointment', 400)
  }

  const treatment = await prisma.$transaction(async (tx) => {
    const created = await createTreatment({
      appointmentId,
      procedure,
      toothNumber: toothNumber ? parseInt(toothNumber) : null,
      notes,
      amount: parseFloat(amount)
    }, tx)

    await updateAppointment(appointmentId, { status: 'COMPLETED' }, tx)

    await createAuditLog({
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.TREATMENT,
      action: AuditAction.TREATMENT_CREATED,
      metadata: { appointmentId, procedure, toothNumber: created.toothNumber, amount: created.amount },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })

  return treatment
}

exports.updateTreatmentService = async (id, body, actor) => {
  const treatment = await findTreatmentById(id)
  if (!treatment) {
    throw new AppError('Treatment not found', 404)
  }

  const allowedFields = ['procedure', 'toothNumber', 'notes', 'amount']
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'toothNumber') updates[field] = parseInt(body[field])
      else if (field === 'amount') updates[field] = parseFloat(body[field])
      else updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await updateTreatment(id, updates, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.TREATMENT,
      action: AuditAction.TREATMENT_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    return result
  })

  return updated
}

exports.deleteTreatmentService = async (id, actor) => {
  const treatment = await findTreatmentById(id)
  if (!treatment) {
    throw new AppError('Treatment not found', 404)
  }

  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.TREATMENT,
      action: AuditAction.TREATMENT_DELETED,
      metadata: { procedure: treatment.procedure },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await softDeleteTreatment(id, tx)
  })

}