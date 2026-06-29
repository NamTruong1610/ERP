const { prisma } = require('../config/PrismaConfig')

const appointmentInclude = {
  dentist: {
    select: {
      id: true,
      email: true,
      name: true
    }
  },
  patient: true,
  treatment: true
}

exports.findAllAppointments = async ({ take = 20, skip = 0 } = {}, client = prisma) => {
  const [appointments, total] = await Promise.all([
    client.appointment.findMany({
      where: { deletedAt: null },  
      include: appointmentInclude,
      orderBy: { date: 'desc' },
      take,
      skip
    }),
    client.appointment.count({ where: { deletedAt: null } })
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
  const now = new Date()

  await client.treatment.updateMany({
    where: { appointmentId: id, deletedAt: null },
    data: { deletedAt: new Date() }
  })

  return await client.appointment.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}