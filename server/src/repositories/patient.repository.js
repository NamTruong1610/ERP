import * as prismaConfig from '../config/prisma.config.js';
export const findAllPatients = async ({ take = 20, skip = 0, search, from, to } = {}, client = prismaConfig.prisma) => {
  const parts = search?.trim() ? search.trim().split(/\s+/) : null
  let where = {
    deletedAt: null,
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) })
      }
    })
  }

  if (parts && parts.length >= 2) {
    where = {
      ...where,
      ...(search && {
        AND: [
          { firstName: { contains: parts[0], mode: 'insensitive' } },
          { lastName: { contains: parts[1], mode: 'insensitive' } }
        ]
      })
    }
  }

  else if (parts) {
    where = {
      ...where,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ]
      })
    }
  }


  const [patients, total] = await Promise.all([
    client.patient.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    client.patient.count({ where })
  ])

  return { patients, total, take, skip }
}

export const findPatientById = async (id) => {
  return await prismaConfig.prisma.patient.findFirst({
    where: { id, deletedAt: null },
    include: {
      appointments: {
        where: { deletedAt: null },
        include: {
          dentist: { select: { id: true, email: true, name: true } },
          visit: {
            select: {
              id: true,
              status: true,
              visitDate: true,
              treatments: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' }
              }
            }
          }
        },
        orderBy: { date: 'desc' }
      }
    }
  })
}

export const findInvoicedTreatmentByPatientId = async (patientId, client = prismaConfig.prisma) => {
  return await client.treatment.findFirst({
    where: {
      visit: { patientId },
      deletedAt: null,
      invoiceItem: { isNot: null }
    },
    select: { id: true, procedure: true }
  })
}

export const createPatient = async (data, client = prismaConfig.prisma) => {
  return await client.patient.create({ data })
}

export const updatePatient = async (id, data, client = prismaConfig.prisma) => {
  return await client.patient.update({
    where: { id },
    data
  })
}

export const hardDeletePatient = async (id) => {
  return await prismaConfig.prisma.patient.delete({
    where: { id }
  })
}

export const softDeletePatient = async (id, client = prismaConfig.prisma) => {
  await client.treatment.updateMany({
    where: {
      visit: { patientId: id },
      deletedAt: null
    },
    data: { deletedAt: new Date() }
  })

  await client.visit.updateMany({
    where: { patientId: id, deletedAt: null },
    data: { deletedAt: new Date() }
  })

  await client.appointment.updateMany({
    where: { patientId: id, deletedAt: null },
    data: { deletedAt: new Date() }
  })

  return await client.patient.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}