const {
  getAllAppointmentsService,
  getAppointmentService,
  getMyAppointmentsService,
  getAppointmentsByPatientService,
  createAppointmentService,
  updateAppointmentService,
  deleteAppointmentService
} = require('../services/appointmentService')

exports.getAllAppointmentsController = async (req, res, next) => {
  const { take = 20, skip = 0, search, from, to } = req.query
  const result = await getAllAppointmentsService({ take, skip, search, from, to })
  return res.status(200).json(result)
}

exports.getAppointmentController = async (req, res, next) => {
  const { id } = req.params
  const appointment = await getAppointmentService(id)
  return res.status(200).json({ appointment })
}

exports.getMyAppointmentsController = async (req, res, next) => {
  const { id } = req.user
  const appointments = await getMyAppointmentsService(id)
  return res.status(200).json({ appointments })
}

exports.getAppointmentsByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  const appointments = await getAppointmentsByPatientService(patientId)
  return res.status(200).json({ appointments })
}

exports.createAppointmentController = async (req, res, next) => {
  const { dentistId, patientId, date, notes } = req.body
  const appointment = await createAppointmentService(
    { dentistId, patientId, date, notes },
    {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  )

  return res.status(201).json({ appointment })
}

exports.updateAppointmentController = async (req, res, next) => {
  const { id } = req.params
  const appointment = await updateAppointmentService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })
  return res.status(200).json({ appointment })
}

exports.deleteAppointmentController = async (req, res, next) => {
  const { id } = req.params
  await deleteAppointmentService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: 'Appointment deleted successfully' })
}