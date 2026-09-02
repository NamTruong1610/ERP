import * as patientService from '../services/patient.service.js';
export const getAllPatientsController = async (req, res, next) => {
  const { take = 20, skip = 0, search, from, to } = req.query
  const patients = await patientService.getAllPatientsService({ take, skip, search, from, to })
  return res.status(200).json(patients)
}

export const getPatientController = async (req, res, next) => {
  const { id } = req.params
  const patient = await patientService.getPatientService(id)
  return res.status(200).json({ patient })
}

export const createPatientController = async (req, res, next) => {
  const { firstName, lastName, dob, gender, phone, email, address } = req.body
  const patient = await patientService.createPatientService({ firstName, lastName, dob, gender, phone, email, address }, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })


  return res.status(201).json({ patient })
}

export const updatePatientController = async (req, res, next) => {
  const { id } = req.params
  const patient = await patientService.updatePatientService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ patient })
}

export const deletePatientController = async (req, res, next) => {
  const { id } = req.params
  await patientService.deletePatientService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: 'Patient deleted successfully' })
}