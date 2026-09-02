import * as patientRepository from '../repositories/patient.repository.js';
import * as statsRepository from '../repositories/stats.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { TargetType, AuditAction } from '@prisma/client';
export const getAllPatientsService = async ({ take, skip, search, from, to }) => {
  const patients = await patientRepository.findAllPatients({
    take: Math.min(parseInt(take), 100),
    skip: parseInt(skip),
    search: search?.trim() || undefined,
    from,
    to
  })
  return patients

}

export const getPatientService = async (id) => {
  const patient = await patientRepository.findPatientById(id)
  if (!patient) {
    throw new appError.AppError('Patient not found', 404)
  }
  return patient
}

export const createPatientService = async ({ firstName, lastName, dob, gender, phone, email, address }, actor) => {
  if (!firstName || !lastName || !dob || !gender) {
    throw new appError.AppError('First name, last name, date of birth and gender are required', 400)
  }

  const patient = await prismaConfig.prisma.$transaction(async (tx) => {
    const created = await patientRepository.createPatient({
      firstName,
      lastName,
      dob: new Date(dob),
      gender,
      phone,
      email,
      address
    }, tx)

    await auditRepository.createAuditLog({
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

  await statsRepository.invalidateClinicStats()

  return patient
}

export const updatePatientService = async (id, body, actor) => {
  const patientRecord = await patientRepository.findPatientById(id)

  if (!patientRecord) {
    throw new appError.AppError('Patient not found', 404)
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
    throw new appError.AppError('No valid fields provided', 400)
  }

  const patient = await prismaConfig.prisma.$transaction(async (tx) => {
    const result = await patientRepository.updatePatient(id, updates, tx)
    await auditRepository.createAuditLog({
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

export const deletePatientService = async (id, actor) => {
  const patient = await patientRepository.findPatientById(id)
  if (!patient) {
    throw new appError.AppError('Patient not found', 404)
  }

  const invoicedTreatment = await patientRepository.findInvoicedTreatmentByPatientId(id)
  if (invoicedTreatment) {
    throw new appError.AppError('Cannot delete a patient with treatments that have already been invoiced', 409)
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
      actorId: actor.id,
      targetId: id,
      targetType: TargetType.PATIENT,
      action: AuditAction.PATIENT_DELETED,
      metadata: { firstName: patient.firstName, lastName: patient.lastName },
      ip: actor.ip,
      userAgent: actor.userAgent
    }, tx)
    await patientRepository.softDeletePatient(id, tx)
  })
}