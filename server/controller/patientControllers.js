const {
  getAllPatientsService,
  getPatientService,
  createPatientService,
  updatePatientService,
  deletePatientService
} = require('../service/patientService')

const { AppError } = require('../utils/errorsUtil.js');

exports.getAllPatientsController = async (req, res, next) => {
  const { take = 20, skip = 0, search, from, to } = req.query
  try {
    const patients = await getAllPatientsService({ take, skip, search, from, to })
    return res.status(200).json(patients)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getPatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const patient = await getPatientService(id)
    return res.status(200).json({ patient })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.createPatientController = async (req, res, next) => {
  const { firstName, lastName, dob, gender, phone, email, address } = req.body
  try {
    const patient = await createPatientService({ firstName, lastName, dob, gender, phone, email, address }, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })


    return res.status(201).json({ patient })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.updatePatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    const patient = await updatePatientService(id, req.body, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ patient })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.deletePatientController = async (req, res, next) => {
  const { id } = req.params
  try {
    await deletePatientService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    return res.status(200).json({ message: 'Patient deleted successfully' })
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}