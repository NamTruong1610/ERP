import * as appointmentService from '../services/appointment.service.js';
export const getAllAppointmentsController = async (req, res, next) => {
  const { take = 20, skip = 0, search, from, to } = req.query
  const result = await appointmentService.getAllAppointmentsService({ take, skip, search, from, to })
  return res.status(200).json(result)
}

export const getAppointmentController = async (req, res, next) => {
  const { id } = req.params
  const appointment = await appointmentService.getAppointmentService(id)
  return res.status(200).json({ appointment })
}

export const getMyAppointmentsController = async (req, res, next) => {
  const { id } = req.user
  const appointments = await appointmentService.getMyAppointmentsService(id)
  return res.status(200).json({ appointments })
}

export const getAppointmentsByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  const appointments = await appointmentService.getAppointmentsByPatientService(patientId)
  return res.status(200).json({ appointments })
}

export const createAppointmentController = async (req, res, next) => {
  const { dentistId, patientId, date, notes } = req.body
  const appointment = await appointmentService.createAppointmentService(
    { dentistId, patientId, date, notes },
    {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  )

  return res.status(201).json({ appointment })
}

export const updateAppointmentController = async (req, res, next) => {
  const { id } = req.params
  const appointment = await appointmentService.updateAppointmentService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })
  return res.status(200).json({ appointment })
}

export const deleteAppointmentController = async (req, res, next) => {
  const { id } = req.params
  await appointmentService.deleteAppointmentService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: 'Appointment deleted successfully' })
}