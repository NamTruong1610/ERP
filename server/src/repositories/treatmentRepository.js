const { prisma } = require('../config/PrismaConfig')

const treatmentInclude = {
  visit: {
    include: {
      patient: true,
      visitProviders: {
        include: {
          performer: { select: { id: true, email: true, name: true } }
        }
      }
    }
  },
  treatmentPlan: {
    select: { id: true, title: true, status: true }
  },
  treatmentPlanItem: {
    select: { id: true, estimatedAmount: true }
  },
  performedBy: {
    select: { id: true, email: true, name: true }
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

// Replaces findTreatmentByAppointmentId — a Visit can now have many
// Treatments, so this returns a list, not a single record.
exports.findTreatmentsByVisitId = async (visitId, client = prisma) => {
  return await client.treatment.findMany({
    where: { visitId, deletedAt: null },
    include: treatmentInclude,
    orderBy: { createdAt: 'asc' }
  })
}

exports.findTreatmentsByIds = async (ids, client = prisma) => {
  return await client.treatment.findMany({
    where: {
      id: { in: ids },
      deletedAt: null
    },
    include: {
      visit: {
        select: { patientId: true }
      },
      invoiceItem: {
        select: { id: true }
      }
    }
  })
}

exports.findUnbilledTreatmentsByPatient = async (patientId, client = prisma) => {
  return await client.treatment.findMany({
    where: {
      visit: { patientId },
      deletedAt: null,
      invoiceItem: null
    },
    include: treatmentInclude,
    orderBy: { createdAt: 'desc' }
  })
}

exports.findAllTreatmentsByPatient = async (patientId, client = prisma) => {
  return await client.treatment.findMany({
    where: {
      visit: { patientId },
      deletedAt: null
    },
    include: treatmentInclude,
    orderBy: { createdAt: 'desc' }
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