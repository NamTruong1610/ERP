const {
  findAllPatients,
  findPatientById,
  createPatient,
  updatePatient,
  softDeletePatient
} = require('../services/patientService')

const { createAuditLog } = require('../services/auditServices')
const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType } = require('@prisma/client')

exports.getAllPatientsController = async (req, res, next) => {
  const { take = 20, skip = 0 } = req.query
  try {
    const result = await findAllPatients({
      take: Math.min(parseInt(take), 100),
      skip: parseInt(skip)
    })
    return res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

exports.getPatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const patient = await findPatientById(id)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }
    return res.status(200).json({ patient })
  } catch (error) {
    next(error)
  }
}

exports.createPatientController = async (req, res, next) => {
  const { firstName, lastName, dob, gender, phone, email, address } = req.body
  try {
    if (!firstName || !lastName || !dob || !gender) {
      return res.status(400).json({ message: 'First name, last name, date of birth and gender are required' })
    }

    const patient = await prisma.$transaction(async (tx) => {
      const created = await createPatient({
        firstName,
        lastName,
        dob: new Date(dob),
        gender,
        phone,
        email,
        address
      }, tx)

      await createAuditLog({
        actorId: req.user.id,
        targetId: created.id,
        targetType: TargetType.PATIENT,
        action: AuditAction.PATIENT_CREATED,
        metadata: { firstName, lastName },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)

      return created
    })

    return res.status(201).json({ patient })
  } catch (error) {
    next(error)
  }
}

exports.updatePatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const patientRecord = await findPatientById(id)

    if (!patientRecord) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    const allowedFields = ['firstName', 'lastName', 'dob', 'gender', 'phone', 'email', 'address']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'dob' ? new Date(req.body[field]) : req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    const patient = await prisma.$transaction(async (tx) => {
      const result = await updatePatient(id, updates, tx)
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.PATIENT,
        action: AuditAction.PATIENT_UPDATED,
        metadata: { fields: Object.keys(updates) },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      return result
    })

    return res.status(200).json({ patient })
  } catch (error) {
    next(error)
  }
}

exports.deletePatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const patient = await findPatientById(id)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorId: req.user.id,
        targetId: id,
        targetType: TargetType.PATIENT,
        action: AuditAction.PATIENT_DELETED,
        metadata: { firstName: patient.firstName, lastName: patient.lastName },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, tx)
      await softDeletePatient(id, tx)
    })

    return res.status(200).json({ message: 'Patient deleted successfully' })
  } catch (error) {
    next(error)
  }
}