const {
  getAllPatientsService,
  getPatientService,
  createPatientService,
  updatePatientService,
  deletePatientService
} = require('../services/patientService')

exports.getAllPatientsController = async (req, res, next) => {
  const { take = 20, skip = 0, search, from, to } = req.query
  const patients = await getAllPatientsService({ take, skip, search, from, to })
  return res.status(200).json(patients)
}

exports.getPatientController = async (req, res, next) => {
  const { id } = req.params
  const patient = await getPatientService(id)
  return res.status(200).json({ patient })
}

exports.createPatientController = async (req, res, next) => {
  const { firstName, lastName, dob, gender, phone, email, address } = req.body
  const patient = await createPatientService({ firstName, lastName, dob, gender, phone, email, address }, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })


  return res.status(201).json({ patient })
}

exports.updatePatientController = async (req, res, next) => {
  const { id } = req.params
  const patient = await updatePatientService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ patient })
}

exports.deletePatientController = async (req, res, next) => {
  const { id } = req.params
  await deletePatientService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: 'Patient deleted successfully' })
}