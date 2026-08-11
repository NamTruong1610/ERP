const { prisma } = require('../config/PrismaConfig')

const appointmentInclude = {
  dentist: {
    select: { id: true, email: true, name: true }
  },
  patient: true,
  visit: {
    select: {
      id: true,
      status: true,
      visitDate: true,
      treatments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' }
      }
    }
  }
}

exports.findAllAppointments = async ({ take = 20, skip = 0, search, from, to } = {}, client = prisma) => {
  const parts = search && search.trim().split(/\s+/)
  let where = {
    ...((from || to) && {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) })
      }
    }),
    deletedAt: null
  }

  if (parts && parts.length === 1) {
    where = {
      ...where,
      ...(search && {
        patient: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ]
        }
      })
    }
  }

  else if (parts && parts.length > 1) {
    where = {
      ...where,
      ...(search && {
        patient: {
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' } },
          ]
        }
      })
    }
  }

  const [appointments, total] = await Promise.all([
    client.appointment.findMany({
      where,
      include: appointmentInclude,   // ← was missing
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    client.appointment.count({ where })
  ])

  return { appointments, total, take, skip }
}

exports.findAppointmentById = async (id) => {
  return await prisma.appointment.findFirst({
    where: { id, deletedAt: null },
    include: appointmentInclude
  })
}

exports.findAppointmentsByDentist = async (dentistId) => {
  return await prisma.appointment.findMany({
    where: { dentistId, deletedAt: null },
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
}

exports.findAppointmentsByPatient = async (patientId) => {
  return await prisma.appointment.findMany({
    where: { patientId, deletedAt: null },
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
}

exports.createAppointment = async (data, client = prisma) => {
  return await client.appointment.create({
    data,
    include: appointmentInclude
  })
}

exports.updateAppointment = async (id, data, client = prisma) => {
  return await client.appointment.update({
    where: { id },
    data,
    include: appointmentInclude
  })
}

exports.softDeleteAppointment = async (id, client = prisma) => {
  return await client.appointment.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}