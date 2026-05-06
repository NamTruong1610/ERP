const {
  findAllPatients,
  findPatientById,
  createPatient,
  updatePatient,
  deletePatient
} = require('../services/patientService')

exports.getAllPatientsController = async (req, res, next) => {
  try {
    const patients = await findAllPatients()
    return res.status(200).json({ patients })
  } catch (error) {
    next(error)
  }
}

exports.getPatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const patient = await findPatientById(id)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }
    return res.status(200).json({ patient })
  } catch (error) {
    next(error)
  }
}

exports.createPatientController = async (req, res, next) => {
  const { firstName, lastName, dob, gender, phone, email, address } = req.body
  try {
    if (!firstName || !lastName || !dob || !gender) {
      return res.status(400).json({ message: 'First name, last name, date of birth and gender are required' })
    }

    const patient = await createPatient({
      firstName,
      lastName,
      dob: new Date(dob),
      gender,
      phone,
      email,
      address
    })

    return res.status(201).json({ patient })
  } catch (error) {
    next(error)
  }
}

exports.updatePatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const allowedFields = ['firstName', 'lastName', 'dob', 'gender', 'phone', 'email', 'address']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'dob' ? new Date(req.body[field]) : req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    const patient = await updatePatient(id, updates)
    return res.status(200).json({ patient })
  } catch (error) {
    next(error)
  }
}

exports.deletePatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const patient = await findPatientById(id)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    await deletePatient(id)
    return res.status(200).json({ message: 'Patient deleted successfully' })
  } catch (error) {
    next(error)
  }
}