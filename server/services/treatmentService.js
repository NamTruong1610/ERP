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
    where: { deletedAt: null },  
    include: treatmentInclude,
    orderBy: { createdAt: 'desc' }
  })
}

exports.findTreatmentById = async (id) => {
  return await prisma.treatment.findFirst({  
    where: { id, deletedAt: null },
    include: treatmentInclude
  })
}

exports.findTreatmentByAppointmentId = async (appointmentId) => {
  return await prisma.treatment.findFirst({  
    where: { appointmentId, deletedAt: null },
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

exports.softDeleteTreatment = async (id) => {
  return await prisma.treatment.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}