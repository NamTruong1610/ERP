const {
  findAllPatients,
  findPatientById,
  createPatient,
  updatePatient,
  softDeletePatient
} = require('../repositories/patientRepository')

const { invalidateClinicStats } = require('../repositories/statsRepository')
const { createAuditLog } = require('../repositories/auditRepository')
const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType } = require('@prisma/client')

exports.getAllPatientsService = async ({ take, skip, search, from, to }) => {
  const patients = await findAllPatients({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    search: search?.trim() || undefined,
    from,
    to
  })
  return patients

}

exports.getPatientService = async (id) => {
  const patient = await findPatientById(id)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }
  return patient
}

exports.createPatientService = async ({ firstName, lastName, dob, gender, phone, email, address }, actor) => {
  if (!firstName || !lastName || !dob || !gender) {
    throw new AppError('First name, last name, date of birth and gender are required', 400)
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
      actorId: actor.id,
      targetId: created.id,
      targetType: TargetType.PATIENT,
      action: AuditAction.PATIENT_CREATED,
      metadata: { firstName, lastName },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)

    return created
  })

  await invalidateClinicStats()

  return patient
}

exports.updatePatientService = async (id, body, actor) => {
  const patientRecord = await findPatientById(id)

  if (!patientRecord) {
    throw new AppError('Patient not found', 404)
  }

  const allowedFields = ['firstName', 'lastName', 'dob', 'gender', 'phone', 'email', 'address']
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'dob') {
        updates[field] = new Date(body[field])
      } else if (['phone', 'email', 'address'].includes(field)) {
        updates[field] = body[field]?.trim() || null  // '' → null
      } else {
        updates[field] = body[field]
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided', 400)
  }

  const patient = await prisma.$transaction(async (tx) => {
    const result = await updatePatient(id, updates, tx)
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.PATIENT,
      action: AuditAction.PATIENT_UPDATED,
      metadata: { fields: Object.keys(updates) },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    return result
  })
  return patient
}

exports.deletePatientService = async (id, actor) => {
  const patient = await findPatientById(id)
  if (!patient) {
    throw new AppError('Patient not found', 404)
  }

  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.PATIENT,
      action: AuditAction.PATIENT_DELETED,
      metadata: { firstName: patient.firstName, lastName: patient.lastName },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await softDeletePatient(id, tx)
  })

}