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

exports.findAllAppointments = async () => {
  return await prisma.appointment.findMany({
    where: { deletedAt: null },  // ← add
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
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
    data: { deletedAt: now }
  })

  return await client.appointment.update({
    where: { id },
    data: { deletedAt: now }
  })
}