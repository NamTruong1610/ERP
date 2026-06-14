const { findAppointmentById } = require('../services/appointmentService')
const {
  findAllTreatments,
  findTreatmentById,
  findTreatmentByAppointmentId,
  createTreatment,
  updateTreatment,
  softDeleteTreatment
} = require('../services/treatmentService')

exports.getAllTreatmentsController = async (req, res, next) => {
  try {
    const treatments = await findAllTreatments()
    return res.status(200).json({ treatments })
  } catch (error) {
    next(error)
  }
}

exports.getTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await findTreatmentById(id)
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' })
    }
    return res.status(200).json({ treatment })
  } catch (error) {
    next(error)
  }
}

exports.getTreatmentByAppointmentController = async (req, res, next) => {
  const { appointmentId } = req.params
  try {
    const appointment = await findAppointmentById(appointmentId)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    const treatment = await findTreatmentByAppointmentId(appointmentId)
    if (!treatment) {
      return res.status(404).json({ message: 'No treatment found for this appointment' })
    }

    return res.status(200).json({ treatment })
  } catch (error) {
    next(error)
  }
}

exports.createTreatmentController = async (req, res, next) => {
  const { appointmentId, procedure, toothNumber, notes, cost } = req.body
  try {
    if (!appointmentId || !procedure || cost === undefined) {
      return res.status(400).json({ message: 'Appointment, procedure and cost are required' })
    }

    // Validate appointment exists
    const appointment = await findAppointmentById(appointmentId)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    // Check appointment is not cancelled
    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Cannot add treatment to a cancelled appointment' })
    }

    // Check treatment doesn't already exist for this appointment
    const existing = await findTreatmentByAppointmentId(appointmentId)
    if (existing) {
      return res.status(400).json({ message: 'Treatment already exists for this appointment' })
    }

    const treatment = await createTreatment({
      appointmentId,
      procedure,
      toothNumber: toothNumber ? parseInt(toothNumber) : null,
      notes,
      cost: parseFloat(cost)
    })

    // Mark appointment as completed
    const { updateAppointment } = require('../services/appointmentService')
    await updateAppointment(appointmentId, { status: 'COMPLETED' })

    return res.status(201).json({ treatment })
  } catch (error) {
    next(error)
  }
}

exports.updateTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await findTreatmentById(id)
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' })
    }

    const allowedFields = ['procedure', 'toothNumber', 'notes', 'cost']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'toothNumber') updates[field] = parseInt(req.body[field])
        else if (field === 'cost') updates[field] = parseFloat(req.body[field])
        else updates[field] = req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    const updated = await updateTreatment(id, updates)
    return res.status(200).json({ treatment: updated })
  } catch (error) {
    next(error)
  }
}

exports.deleteTreatmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const treatment = await findTreatmentById(id)
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' })
    }

    await softDeleteTreatment(id)
    return res.status(200).json({ message: 'Treatment deleted successfully' })
  } catch (error) {
    next(error)
  }
}