const { prisma } = require('../config/PrismaConfig')

const visitInclude = {
  patient: {
    select: { id: true, firstName: true, lastName: true }
  },
  appointment: {
    select: { id: true, date: true, status: true }
  },
  visitProviders: {
    include: {
      performer: { select: { id: true, email: true, name: true } }
    }
  },
  treatments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      invoiceItem: { select: { id: true } }   // <-- added, needed for the delete-block check
    }
  }
}

exports.findAllVisits = async ({ take = 20, skip = 0, patientId } = {}, client = prisma) => {
  const where = {
    deletedAt: null,
    ...(patientId && { patientId })
  }
  const [visits, total] = await Promise.all([
    client.visit.findMany({
      where,
      include: visitInclude,
      orderBy: { visitDate: 'desc' },
      take,
      skip
    }),
    client.visit.count({ where })
  ])
  return { visits, total, take, skip }
}

exports.findVisitById = async (id, client = prisma) => {
  return await client.visit.findFirst({
    where: { id, deletedAt: null },
    include: visitInclude
  })
}

// Used before creating a walk-in-from-appointment visit — Visit.appointmentId
// is unique, so this guards against creating a second Visit off the same
// Appointment.
exports.findVisitByAppointmentId = async (appointmentId, client = prisma) => {
  return await client.visit.findFirst({
    where: { appointmentId, deletedAt: null },
    include: visitInclude
  })
}

exports.createVisit = async (data, client = prisma) => {
  return await client.visit.create({
    data,
    include: visitInclude
  })
}

exports.updateVisitById = async (id, data, client = prisma) => {
  return await client.visit.update({
    where: { id },
    data,
    include: visitInclude
  })
}

exports.softDeleteVisit = async (id, client = prisma) => {
  return await client.visit.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

// ─── VisitProvider (folded in — no separate repo file) ─────────────────────

exports.findVisitProviderById = async (id, client = prisma) => {
  return await client.visitProvider.findFirst({
    where: { id },
    include: {
      visit: { select: { id: true, patientId: true } },
      performer: { select: { id: true, email: true, name: true } }
    }
  })
}

exports.addVisitProvider = async (data, client = prisma) => {
  return await client.visitProvider.create({
    data,
    include: {
      performer: { select: { id: true, email: true, name: true } }
    }
  })
}

exports.updateVisitProviderById = async (id, data, client = prisma) => {
  return await client.visitProvider.update({
    where: { id },
    data,
    include: {
      performer: { select: { id: true, email: true, name: true } }
    }
  })
}

exports.removeVisitProvider = async (id, client = prisma) => {
  // Hard delete — this is a pure join row, no accounting/audit footprint of
  // its own worth preserving as a soft-deleted record.
  return await client.visitProvider.delete({
    where: { id }
  })
}

exports.countVisitProvidersByVisitId = async (visitId, client = prisma) => {
  return await client.visitProvider.count({ where: { visitId } })
}