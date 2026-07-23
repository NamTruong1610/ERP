const { prisma } = require('../config/PrismaConfig')

exports.findAllPatients = async ({ take = 20, skip = 0, search, from, to } = {}, client = prisma) => {
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

exports.findPatientById = async (id) => {
  return await prisma.patient.findFirst({
    where: { id, deletedAt: null },
    include: {
      appointments: {
        where: { deletedAt: null },
        include: {
          dentist: {
            select: {
              id: true,
              email: true,
              name: true
            }
          },
          treatment: true
        },
        orderBy: { date: 'desc' }
      }
    }
  })
}

exports.createPatient = async (data, client = prisma) => {
  return await client.patient.create({ data })
}

exports.updatePatient = async (id, data, client = prisma) => {
  return await client.patient.update({
    where: { id },
    data
  })
}

exports.hardDeletePatient = async (id) => {
  return await prisma.patient.delete({
    where: { id }
  })
}

exports.softDeletePatient = async (id, client = prisma) => {
  const now = new Date()
  await client.treatment.updateMany({
    where: {
      appointment: { patientId: id },
      deletedAt: null
    },
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