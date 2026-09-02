import * as prismaConfig from '../config/prisma.config.js';
const treatmentPlanInclude = {
  patient: {
    select: { id: true, firstName: true, lastName: true }
  },
  createdBy: {
    select: { id: true, email: true, name: true }
  },
  treatmentPlanItems: {
    orderBy: { createdAt: 'asc' }
  },
  treatments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' }
  }
}

export const findAllTreatmentPlans = async ({ take = 20, skip = 0, patientId } = {}, client = prismaConfig.prisma) => {
  const where = {
    deletedAt: null,
    ...(patientId && { patientId })
  }
  const [treatmentPlans, total] = await Promise.all([
    client.treatmentPlan.findMany({
      where,
      include: treatmentPlanInclude,
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    client.treatmentPlan.count({ where })
  ])
  return { treatmentPlans, total, take, skip }
}

export const findTreatmentPlanById = async (id, client = prismaConfig.prisma) => {
  return await client.treatmentPlan.findFirst({
    where: { id, deletedAt: null },
    include: treatmentPlanInclude
  })
}

export const createTreatmentPlan = async (data, client = prismaConfig.prisma) => {
  return await client.treatmentPlan.create({
    data,
    include: treatmentPlanInclude
  })
}

export const updateTreatmentPlanById = async (id, data, client = prismaConfig.prisma) => {
  return await client.treatmentPlan.update({
    where: { id },
    data,
    include: treatmentPlanInclude
  })
}

export const softDeleteTreatmentPlan = async (id, client = prismaConfig.prisma) => {
  return await client.treatmentPlan.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

// Bulk-attach existing Treatments to a plan (sets treatmentPlanId on each) —
// used by attachTreatmentsToTreatmentPlanService.
export const attachTreatmentsToPlan = async (treatmentPlanId, treatmentIds, client = prismaConfig.prisma) => {
  return await client.treatment.updateMany({
    where: { id: { in: treatmentIds } },
    data: { treatmentPlanId }
  })
}

export const cancelProposedItemsByPlanId = async (treatmentPlanId, client = prismaConfig.prisma) => {
  return await client.treatmentPlanItem.updateMany({
    where: { treatmentPlanId, status: 'PROPOSED' },
    data: { status: 'CANCELLED' }
  })
}