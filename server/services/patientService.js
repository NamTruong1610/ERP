const { prisma } = require('../config/PrismaConfig')

exports.findAllPatients = async () => {
  return await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

exports.findPatientById = async (id) => {
  return await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: {
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

exports.deletePatient = async (id) => {
  return await prisma.patient.delete({
    where: { id }
  })
}