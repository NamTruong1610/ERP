const {
  getAllAppointmentsService,
  getAppointmentService,
  getMyAppointmentsService,
  getAppointmentsByPatientService,
  createAppointmentService,
  updateAppointmentService,
  deleteAppointmentService
} = require('../services/appointmentService')

const { AppError } = require('../lib/AppError');

exports.getAllAppointmentsController = async (req, res, next) => {
  const { take = 20, skip = 0, search, from, to } = req.query
  try {
    const result = await getAllAppointmentsService({ take, skip, search, from, to })
    return res.status(200).json(result)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await getAppointmentService(id)
    return res.status(200).json({ appointment })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getMyAppointmentsController = async (req, res, next) => {
  const { id } = req.user
  try {
    const appointments = await getMyAppointmentsService(id)
    return res.status(200).json({ appointments })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getAppointmentsByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  try {
    const appointments = await getAppointmentsByPatientService(patientId)
    return res.status(200).json({ appointments })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.createAppointmentController = async (req, res, next) => {
  const { dentistId, patientId, date, notes } = req.body
  try {
    const appointment = await createAppointmentService(
      { dentistId, patientId, date, notes },
      {
        id: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )

    return res.status(201).json({ appointment })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.updateAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await updateAppointmentService(id, req.body, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ appointment })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.deleteAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    await deleteAppointmentService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: 'Appointment deleted successfully' })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}