import * as prismaConfig from '../config/prisma.config.js';
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
      },
      visitProviders: {
        include: {
          performer: { select: { id: true, email: true, name: true } }
        }
      }
    }
  }
}

export const findAllAppointments = async ({ take = 20, skip = 0, search, from, to } = {}, client = prismaConfig.prisma) => {
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

export const findAppointmentById = async (id) => {
  return await prismaConfig.prisma.appointment.findFirst({
    where: { id, deletedAt: null },
    include: appointmentInclude
  })
}

export const findAppointmentsByDentist = async (dentistId) => {
  return await prismaConfig.prisma.appointment.findMany({
    where: { dentistId, deletedAt: null },
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
}

export const findAppointmentsByPatient = async (patientId) => {
  return await prismaConfig.prisma.appointment.findMany({
    where: { patientId, deletedAt: null },
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
}

export const createAppointment = async (data, client = prismaConfig.prisma) => {
  return await client.appointment.create({
    data,
    include: appointmentInclude
  })
}

export const updateAppointment = async (id, data, client = prismaConfig.prisma) => {
  return await client.appointment.update({
    where: { id },
    data,
    include: appointmentInclude
  })
}

export const softDeleteAppointment = async (id, client = prismaConfig.prisma) => {
  return await client.appointment.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}