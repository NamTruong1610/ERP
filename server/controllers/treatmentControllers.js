const { findAppointmentById, updateAppointment } = require('../services/appointmentService')
const {
  findAllTreatments,
  findTreatmentById,
  findTreatmentByAppointmentId,
  findUnbilledTreatmentsByPatient,
  createTreatment,
  updateTreatment,
  softDeleteTreatment
} = require('../services/treatmentService')
const { findPatientById } = require('../services/patientService')

const { createAuditLog } = require('../services/auditServices')
const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType } = require('@prisma/client')

exports.getAllTreatmentsController = async (req, res, next) => {
  const { take = 20, skip = 0 } = req.query
  try {
    const result = await findAllTreatments({
      take: Math.min(parseInt(take), 100),
      skip: parseInt(skip)
    })
    return res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

exports.getTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await findTreatmentById(id)
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' })
    }
    return res.status(200).json({ treatment })
  } catch (error) {
    next(error)
  }
}

exports.getTreatmentByAppointmentController = async (req, res, next) => {
  const { appointmentId } = req.params
  try {
    const appointment = await findAppointmentById(appointmentId)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    const treatment = await findTreatmentByAppointmentId(appointmentId)
    if (!treatment) {
      return res.status(404).json({ message: 'No treatment found for this appointment' })
    }

    return res.status(200).json({ treatment })
  } catch (error) {
    next(error)
  }
}

exports.getUnbilledTreatmentsController = async (req, res, next) => {
  const { patientId } = req.params
  try {
    const patient = await findPatientById(patientId)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    const treatments = await findUnbilledTreatmentsByPatient(patientId)
    return res.status(200).json({ treatments })
  } catch (error) {
    next(error)
  }
}

exports.createTreatmentController = async (req, res, next) => {
  const { appointmentId, procedure, toothNumber, notes, amount } = req.body
  try {
    if (!appointmentId || !procedure || amount === undefined) {
      return res.status(400).json({ message: 'Appointment, procedure and amount are required' })
    }

    // Validate appointment exists
    const appointment = await findAppointmentById(appointmentId)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    // Check appointment is not cancelled
    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Cannot add treatment to a cancelled appointment' })
    }

    // Check treatment doesn't already exist for this appointment
    const existing = await findTreatmentByAppointmentId(appointmentId)
    if (existing) {
      return res.status(400).json({ message: 'Treatment already exists for this appointment' })
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
        actorId: req.user.id,
        targetId: created.id,
        targetType: TargetType.TREATMENT,
        action: AuditAction.TREATMENT_CREATED,
        metadata: { appointmentId, procedure, toothNumber: created.toothNumber, amount: created.amount },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return created
    })

    return res.status(201).json({ treatment })
  } catch (error) {
    next(error)
  }
}

exports.updateTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await findTreatmentById(id)
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' })
    }

    const allowedFields = ['procedure', 'toothNumber', 'notes', 'amount']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'toothNumber') updates[field] = parseInt(req.body[field])
        else if (field === 'amount') updates[field] = parseFloat(req.body[field])
        else updates[field] = req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await updateTreatment(id, updates, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.TREATMENT,
        action: AuditAction.TREATMENT_UPDATED,
        metadata: { fields: Object.keys(updates) },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      return result
    })

    return res.status(200).json({ treatment: updated })
  } catch (error) {
    next(error)
  }
}

exports.deleteTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await findTreatmentById(id)
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' })
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.TREATMENT,
        action: AuditAction.TREATMENT_DELETED,
        metadata: { procedure: treatment.procedure },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      await softDeleteTreatment(id, tx)
    })

    return res.status(200).json({ message: 'Treatment deleted successfully' })
  } catch (error) {
    next(error)
  }
}
