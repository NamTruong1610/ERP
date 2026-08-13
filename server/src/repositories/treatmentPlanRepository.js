const { prisma } = require('../config/PrismaConfig')

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

exports.findAllTreatmentPlans = async ({ take = 20, skip = 0, patientId } = {}, client = prisma) => {
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

exports.findTreatmentPlanById = async (id, client = prisma) => {
  return await client.treatmentPlan.findFirst({
    where: { id, deletedAt: null },
    include: treatmentPlanInclude
  })
}

exports.createTreatmentPlan = async (data, client = prisma) => {
  return await client.treatmentPlan.create({
    data,
    include: treatmentPlanInclude
  })
}

exports.updateTreatmentPlanById = async (id, data, client = prisma) => {
  return await client.treatmentPlan.update({
    where: { id },
    data,
    include: treatmentPlanInclude
  })
}

exports.softDeleteTreatmentPlan = async (id, client = prisma) => {
  return await client.treatmentPlan.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

// Bulk-attach existing Treatments to a plan (sets treatmentPlanId on each) —
// used by attachTreatmentsToTreatmentPlanService.
exports.attachTreatmentsToPlan = async (treatmentPlanId, treatmentIds, client = prisma) => {
  return await client.treatment.updateMany({
    where: { id: { in: treatmentIds } },
    data: { treatmentPlanId }
  })
}

exports.cancelProposedItemsByPlanId = async (treatmentPlanId, client = prisma) => {
  return await client.treatmentPlanItem.updateMany({
    where: { treatmentPlanId, status: 'PROPOSED' },
    data: { status: 'CANCELLED' }
  })
}