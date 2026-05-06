const {
  findAllAppointments,
  findAppointmentById,
  findAppointmentsByDentist,
  findAppointmentsByPatient,
  createAppointment,
  updateAppointment,
  deleteAppointment
} = require('../services/appointmentService')

const { findUserById } = require('../services/userService')
const { findPatientById } = require('../services/patientService')

const VALID_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED']

exports.getAllAppointmentsController = async (req, res, next) => {
  try {
    const appointments = await findAllAppointments()
    return res.status(200).json({ appointments })
  } catch (error) {
    next(error)
  }
}

exports.getAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await findAppointmentById(id)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }
    return res.status(200).json({ appointment })
  } catch (error) {
    next(error)
  }
}

exports.getMyAppointmentsController = async (req, res, next) => {
  const { id } = req.user
  try {
    const appointments = await findAppointmentsByDentist(id)
    return res.status(200).json({ appointments })
  } catch (error) {
    next(error)
  }
}

exports.getAppointmentsByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  try {
    const patient = await findPatientById(patientId)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    const appointments = await findAppointmentsByPatient(patientId)
    return res.status(200).json({ appointments })
  } catch (error) {
    next(error)
  }
}

exports.createAppointmentController = async (req, res, next) => {
  const { dentistId, patientId, date, notes } = req.body
  try {
    if (!dentistId || !patientId || !date) {
      return res.status(400).json({ message: 'Dentist, patient and date are required' })
    }

    // Validate dentist exists and is active
    const dentist = await findUserById(dentistId)
    if (!dentist || dentist.status !== 'ACTIVE') {
      return res.status(404).json({ message: 'Dentist not found' })
    }

    // Validate patient exists
    const patient = await findPatientById(patientId)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    const appointment = await createAppointment({
      dentistId,
      patientId,
      date: new Date(date),
      notes
    })

    return res.status(201).json({ appointment })
  } catch (error) {
    next(error)
  }
}

exports.updateAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await findAppointmentById(id)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    const allowedFields = ['date', 'status', 'notes', 'dentistId']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'date' ? new Date(req.body[field]) : req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` })
    }

    if (updates.dentistId) {
      const dentist = await findUserById(updates.dentistId)
      if (!dentist || dentist.status !== 'ACTIVE') {
        return res.status(404).json({ message: 'Dentist not found' })
      }
    }

    const updated = await updateAppointment(id, updates)
    return res.status(200).json({ appointment: updated })
  } catch (error) {
    next(error)
  }
}

exports.deleteAppointmentController = async (req, res, next) => {
  const { id } = req.params
  try {
    const appointment = await findAppointmentById(id)
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' })
    }

    await deleteAppointment(id)
    return res.status(200).json({ message: 'Appointment deleted successfully' })
  } catch (error) {
    next(error)
  }
}