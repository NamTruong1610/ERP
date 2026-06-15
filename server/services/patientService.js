const { prisma } = require('../config/PrismaConfig')

exports.findAllPatients = async () => {
  return await prisma.patient.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' }
  })
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

exports.createPatient = async (data) => {
  return await prisma.patient.create({ data })
}

exports.updatePatient = async (id, data) => {
  return await prisma.patient.update({
    where: { id },
    data
  })
}

exports.hardDeletePatient = async (id) => {
  return await prisma.patient.delete({
    where: { id }
  })
}

exports.softDeletePatient = async (id) => {
  const now = new Date()
  await prisma.treatment.updateMany({
    where: {
      appointment: { patientId: id },
      deletedAt: null
    },
    data: { deletedAt: now }
  })

  await prisma.appointment.updateMany({
    where: { patientId: id, deletedAt: null },
    data: { deletedAt: now }
  })

  return await prisma.patient.update({
    where: { id },
    data: { deletedAt: now }
  })
}