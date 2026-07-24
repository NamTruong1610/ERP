const {
  getAllTreatmentsService,
  getTreatmentService,
  getTreatmentByAppointmentService,
  getUnbilledTreatmentsService,
  createTreatmentService,
  updateTreatmentService,
  deleteTreatmentService
} = require('../services/treatmentService')

const { AppError } = require('../lib/AppError');

exports.getAllTreatmentsController = async (req, res, next) => {
  const { take = 20, skip = 0 } = req.query
  try {
    const result = await getAllTreatmentsService({ take, skip })
    return res.status(200).json(result)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await getTreatmentService(id)
    return res.status(200).json({ treatment })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getTreatmentByAppointmentController = async (req, res, next) => {
  const { appointmentId } = req.params
  try {
    const treatment = await getTreatmentByAppointmentService(appointmentId)

    return res.status(200).json({ treatment })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getUnbilledTreatmentsController = async (req, res, next) => {
  const { patientId } = req.params
  try {
    const treatments = await getUnbilledTreatmentsService(patientId)
    return res.status(200).json({ treatments })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.createTreatmentController = async (req, res, next) => {
  const { appointmentId, procedure, toothNumber, notes, amount } = req.body
  try {
    const treatment = await createTreatmentService({ appointmentId, procedure, toothNumber, notes, amount }, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(201).json({ treatment })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.updateTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await updateTreatmentService(id, req.body, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ treatment })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.deleteTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    await deleteTreatmentService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: 'Treatment deleted successfully' })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}