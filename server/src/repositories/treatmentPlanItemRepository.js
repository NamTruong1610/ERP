const { prisma } = require('../config/PrismaConfig')

const treatmentPlanItemInclude = {
  treatmentPlan: {
    select: { id: true, patientId: true, status: true }
  },
  treatment: {
    select: { id: true, visitId: true, amount: true, createdAt: true }
  }
}

exports.findTreatmentPlanItemsByPlanId = async (treatmentPlanId, client = prisma) => {
  return await client.treatmentPlanItem.findMany({
    where: { treatmentPlanId },
    include: treatmentPlanItemInclude,
    orderBy: { createdAt: 'asc' }
  })
}

exports.findTreatmentPlanItemById = async (id, client = prisma) => {
  return await client.treatmentPlanItem.findFirst({
    where: { id },
    include: treatmentPlanItemInclude
  })
}

exports.createTreatmentPlanItem = async (data, client = prisma) => {
  return await client.treatmentPlanItem.create({
    data,
    include: treatmentPlanItemInclude
  })
}

// Used by the bulk-add endpoint — createManyAndReturn (Prisma 7) so the
// created rows come back directly rather than needing a follow-up findMany.
exports.createTreatmentPlanItemsBulk = async (dataArray, client = prisma) => {
  return await client.treatmentPlanItem.createManyAndReturn({
    data: dataArray
  })
}

exports.updateTreatmentPlanItemById = async (id, data, client = prisma) => {
  return await client.treatmentPlanItem.update({
    where: { id },
    data,
    include: treatmentPlanItemInclude
  })
}

exports.deleteTreatmentPlanItemById = async (id, client = prisma) => {
  // Hard delete — PROPOSED/CANCELLED items have no accounting footprint and
  // no deletedAt column on this model. Service layer already blocks this for
  // COMPLETED items before this ever runs.
  return await client.treatmentPlanItem.delete({
    where: { id }
  })
}