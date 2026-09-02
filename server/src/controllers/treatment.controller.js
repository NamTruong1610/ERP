import * as treatmentService from '../services/treatment.service.js';
export const getAllTreatmentsController = async (req, res, next) => {
  const { take = 20, skip = 0 } = req.query
  const result = await treatmentService.getAllTreatmentsService({ take, skip })
  return res.status(200).json(result)
}

export const getTreatmentController = async (req, res, next) => {
  const { id } = req.params
  const treatment = await treatmentService.getTreatmentService(id)
  return res.status(200).json({ treatment })
}

export const getTreatmentsByVisitController = async (req, res, next) => {
  const { visitId } = req.params
  const treatments = await treatmentService.getTreatmentsByVisitService(visitId)
  return res.status(200).json({ treatments })
}

export const getUnbilledTreatmentsController = async (req, res, next) => {
  const { patientId } = req.params
  const treatments = await treatmentService.getUnbilledTreatmentsService(patientId)
  return res.status(200).json({ treatments })
}

export const getAllTreatmentsByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  const treatments = await treatmentService.getAllTreatmentsByPatientService(patientId)
  return res.status(200).json({ treatments })
}

export const createTreatmentController = async (req, res, next) => {
  const { visitId, treatmentPlanId, performedById, procedureCatalogId, procedure, toothNumber, notes, amount } = req.body
  const treatment = await treatmentService.createTreatmentService(
    { visitId, treatmentPlanId, performedById, procedureCatalogId, procedure, toothNumber, notes, amount },
    { id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] }
  )
  return res.status(201).json({ treatment })
}

export const updateTreatmentController = async (req, res, next) => {
  const { id } = req.params
  const treatment = await treatmentService.updateTreatmentService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ treatment })
}

export const deleteTreatmentController = async (req, res, next) => {
  const { id } = req.params
  await treatmentService.deleteTreatmentService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: 'Treatment deleted successfully' })
}