const { prisma } = require('../config/PrismaConfig')

exports.findAllPatients = async ({ take = 20, skip = 0 } = {}, client = prisma) => {
  const [patients, total] = await Promise.all([
    client.patient.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    client.patient.count({ where: { deletedAt: null } })
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
    data: { deletedAt: now }
  })

  await client.appointment.updateMany({
    where: { patientId: id, deletedAt: null },
    data: { deletedAt: now }
  })

  return await client.patient.update({
    where: { id },
    data: { deletedAt: now }
  })
}