import * as prismaConfig from '../config/prisma.config.js';
const treatmentPlanItemInclude = {
  treatmentPlan: {
    select: { id: true, patientId: true, status: true }
  },
  treatment: {
    select: { id: true, visitId: true, amount: true, createdAt: true }
  }
}

export const findTreatmentPlanItemsByPlanId = async (treatmentPlanId, client = prismaConfig.prisma) => {
  return await client.treatmentPlanItem.findMany({
    where: { treatmentPlanId },
    include: treatmentPlanItemInclude,
    orderBy: { createdAt: 'asc' }
  })
}

export const findTreatmentPlanItemById = async (id, client = prismaConfig.prisma) => {
  return await client.treatmentPlanItem.findFirst({
    where: { id },
    include: treatmentPlanItemInclude
  })
}

export const createTreatmentPlanItem = async (data, client = prismaConfig.prisma) => {
  return await client.treatmentPlanItem.create({
    data,
    include: treatmentPlanItemInclude
  })
}

// Used by the bulk-add endpoint — createManyAndReturn (Prisma 7) so the
// created rows come back directly rather than needing a follow-up findMany.
export const createTreatmentPlanItemsBulk = async (dataArray, client = prismaConfig.prisma) => {
  return await client.treatmentPlanItem.createManyAndReturn({
    data: dataArray
  })
}

export const updateTreatmentPlanItemById = async (id, data, client = prismaConfig.prisma) => {
  return await client.treatmentPlanItem.update({
    where: { id },
    data,
    include: treatmentPlanItemInclude
  })
}

export const deleteTreatmentPlanItemById = async (id, client = prismaConfig.prisma) => {
  // Hard delete — PROPOSED/CANCELLED items have no accounting footprint and
  // no deletedAt column on this model. Service layer already blocks this for
  // COMPLETED items before this ever runs.
  return await client.treatmentPlanItem.delete({
    where: { id }
  })
}