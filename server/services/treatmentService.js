const { prisma } = require('../config/PrismaConfig')

const treatmentInclude = {
  appointment: {
    include: {
      dentist: {
        select: {
          id: true,
          email: true,
          name: true
        }
      },
      patient: true
    }
  }
}

exports.findAllTreatments = async () => {
  return await prisma.treatment.findMany({
    include: treatmentInclude,
    orderBy: { createdAt: 'desc' }
  })
}

exports.findTreatmentById = async (id) => {
  return await prisma.treatment.findUnique({
    where: { id },
    include: treatmentInclude
  })
}

exports.findTreatmentByAppointmentId = async (appointmentId) => {
  return await prisma.treatment.findUnique({
    where: { appointmentId },
    include: treatmentInclude
  })
}

exports.createTreatment = async (data) => {
  return await prisma.treatment.create({
    data,
    include: treatmentInclude
  })
}

exports.updateTreatment = async (id, data) => {
  return await prisma.treatment.update({
    where: { id },
    data,
    include: treatmentInclude
  })
}

exports.deleteTreatment = async (id) => {
  return await prisma.treatment.delete({
    where: { id }
  })
}