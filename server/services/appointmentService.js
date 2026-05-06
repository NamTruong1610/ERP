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
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
}

exports.findAppointmentById = async (id) => {
  return await prisma.appointment.findUnique({
    where: { id },
    include: appointmentInclude
  })
}

exports.findAppointmentsByDentist = async (dentistId) => {
  return await prisma.appointment.findMany({
    where: { dentistId },
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
}

exports.findAppointmentsByPatient = async (patientId) => {
  return await prisma.appointment.findMany({
    where: { patientId },
    include: appointmentInclude,
    orderBy: { date: 'desc' }
  })
}

exports.createAppointment = async (data) => {
  return await prisma.appointment.create({
    data,
    include: appointmentInclude
  })
}

exports.updateAppointment = async (id, data) => {
  return await prisma.appointment.update({
    where: { id },
    data,
    include: appointmentInclude
  })
}

exports.deleteAppointment = async (id) => {
  return await prisma.appointment.delete({
    where: { id }
  })
}