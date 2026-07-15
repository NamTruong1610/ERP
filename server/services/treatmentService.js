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

exports.findTreatmentsByIds = async (ids, client = prisma) => {
  return await client.treatment.findMany({
    where: {
      id: { in: ids },
      deletedAt: null
    },
    include: {
      appointment: {
        select: { patientId: true }
      },
      invoiceItem: { 
        select: { id: true }
      }
    }
  })
}

// Treatments for a patient that haven't been attached to an InvoiceItem yet —
// the pool clinic staff pick from when generating a new invoice.
exports.findUnbilledTreatmentsByPatient = async (patientId, client = prisma) => {
  return await client.treatment.findMany({
    where: {
      appointment: { patientId },
      deletedAt: null,
      invoiceItem: null
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