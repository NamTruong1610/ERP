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

exports.findAllTreatments = async ({ take = 20, skip = 0 } = {}, client = prisma) => {
  const [treatments, total] = await Promise.all([
    client.treatment.findMany({
      where: { deletedAt: null },
      include: treatmentInclude,
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    client.treatment.count({ where: { deletedAt: null } })
  ])
  return { treatments, total, take, skip }
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

exports.createTreatment = async (data, client = prisma) => {
  return await client.treatment.create({
    data,
    include: treatmentInclude
  })
}

exports.updateTreatment = async (id, data, client = prisma) => {
  return await client.treatment.update({
    where: { id },
    data,
    include: treatmentInclude
  })
}

exports.softDeleteTreatment = async (id, client = prisma) => {
  return await client.treatment.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}