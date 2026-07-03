const {
  findAllAppointments,
  findAppointmentById,
  findAppointmentsByDentist,
  findAppointmentsByPatient,
  createAppointment,
  updateAppointment,
  softDeleteAppointment
} = require('../services/appointmentService')

const { findUserById } = require('../services/userService')
const { findPatientById } = require('../services/patientService')
const { createAuditLog } = require('../services/auditServices')
const { invalidateClinicStats, invalidateMyStats } = require('../services/statsServices')

const { prisma } = require('../config/PrismaConfig')
const { UserStatus, AuditAction, TargetType } = require('@prisma/client')

const VALID_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED']

exports.getAllAppointmentsController = async (req, res, next) => {
  const { take = 20, skip = 0, search, from, to } = req.query
  try {
    const result = await findAllAppointments({
      take: Math.min(parseInt(take), 100),
      skip: parseInt(skip),
      search: search?.trim() || undefined,
      from,
      to
    })
    return res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

exports.getAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await findAppointmentById(id)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }
    return res.status(200).json({ appointment })
  } catch (error) {
    next(error)
  }
}

exports.getMyAppointmentsController = async (req, res, next) => {
  const { id } = req.user
  try {
    const appointments = await findAppointmentsByDentist(id)
    return res.status(200).json({ appointments })
  } catch (error) {
    next(error)
  }
}

exports.getAppointmentsByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  try {
    const patient = await findPatientById(patientId)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    const appointments = await findAppointmentsByPatient(patientId)
    return res.status(200).json({ appointments })
  } catch (error) {
    next(error)
  }
}

exports.createAppointmentController = async (req, res, next) => {
  const { dentistId, patientId, date, notes } = req.body
  try {
    if (!patientId || !date) {
      return res.status(400).json({ message: 'Patient and date are required' })
    }

    // Validate patient exists
    const patient = await findPatientById(patientId)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    // Only validate dentist if one is provided
    if (dentistId) {
      const dentist = await findUserById(dentistId)
      if (!dentist || dentist.status !== UserStatus.ACTIVE) {
        return res.status(404).json({ message: 'Dentist not found' })
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
        actorId: req.user.id,
        targetId: created.id,
        targetType: TargetType.APPOINTMENT,
        action: AuditAction.APPOINTMENT_CREATED,
        metadata: { patientId, dentistId: dentistId ?? null, date: created.date },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return created
    })

    await Promise.all([
      invalidateClinicStats(),
      invalidateMyStats(req.user.id)
    ])

    return res.status(201).json({ appointment })
  } catch (error) {
    next(error)
  }
}

exports.updateAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await findAppointmentById(id)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    const allowedFields = ['date', 'status', 'notes', 'dentistId']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'date') {
          updates[field] = new Date(req.body[field])
        } else if (field === 'dentistId') {
          updates[field] = req.body[field] || null  // convert empty string to null
        } else {
          updates[field] = req.body[field]
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` })
    }

    if (updates.dentistId !== undefined && updates.dentistId !== null) {
      const dentist = await findUserById(updates.dentistId)
      if (!dentist || dentist.status !== UserStatus.ACTIVE) {
        return res.status(404).json({ message: 'Dentist not found' })
      }
    }

    const isCancellation = updates.status === 'CANCELLED' && appointment.status !== 'CANCELLED'

    const updated = await prisma.$transaction(async (tx) => {
      const result = await updateAppointment(id, updates, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.APPOINTMENT,
        action: isCancellation ? AuditAction.APPOINTMENT_CANCELLED : AuditAction.APPOINTMENT_UPDATED,
        metadata: isCancellation
          ? { previousStatus: appointment.status }
          : { fields: Object.keys(updates) },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      return result
    })

    return res.status(200).json({ appointment: updated })
  } catch (error) {
    next(error)
  }
}

exports.deleteAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await findAppointmentById(id)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.APPOINTMENT,
        action: AuditAction.APPOINTMENT_DELETED,
        metadata: { patientId: appointment.patientId },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      await softDeleteAppointment(id, tx)
    })

    return res.status(200).json({ message: 'Appointment deleted successfully' })
  } catch (error) {
    next(error)
  }
}