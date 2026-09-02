import * as prismaConfig from '../config/prisma.config.js';
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

export const findAllTreatments = async ({ take = 20, skip = 0 } = {}, client = prismaConfig.prisma) => {
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

export const findTreatmentById = async (id) => {
  return await prismaConfig.prisma.treatment.findFirst({
    where: { id, deletedAt: null },
    include: treatmentInclude
  })
}

// Replaces findTreatmentByAppointmentId — a Visit can now have many
// Treatments, so this returns a list, not a single record.
export const findTreatmentsByVisitId = async (visitId, client = prismaConfig.prisma) => {
  return await client.treatment.findMany({
    where: { visitId, deletedAt: null },
    include: treatmentInclude,
    orderBy: { createdAt: 'asc' }
  })
}

export const findTreatmentsByIds = async (ids, client = prismaConfig.prisma) => {
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

export const findUnbilledTreatmentsByPatient = async (patientId, client = prismaConfig.prisma) => {
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

export const findAllTreatmentsByPatient = async (patientId, client = prismaConfig.prisma) => {
  return await client.treatment.findMany({
    where: {
      visit: { patientId },
      deletedAt: null
    },
    include: treatmentInclude,
    orderBy: { createdAt: 'desc' }
  })
}

export const createTreatment = async (data, client = prismaConfig.prisma) => {
  return await client.treatment.create({
    data,
    include: treatmentInclude
  })
}

export const updateTreatment = async (id, data, client = prismaConfig.prisma) => {
  return await client.treatment.update({
    where: { id },
    data,
    include: treatmentInclude
  })
}

export const softDeleteTreatment = async (id, client = prismaConfig.prisma) => {
  return await client.treatment.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}