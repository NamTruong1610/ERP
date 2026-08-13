const {
  getAllTreatmentsService,
  getTreatmentService,
  getTreatmentsByVisitService,
  getUnbilledTreatmentsService,
  getAllTreatmentsByPatientService,
  createTreatmentService,
  updateTreatmentService,
  deleteTreatmentService
} = require('../services/treatmentService')

exports.getAllTreatmentsController = async (req, res, next) => {
  const { take = 20, skip = 0 } = req.query
  const result = await getAllTreatmentsService({ take, skip })
  return res.status(200).json(result)
}

exports.getTreatmentController = async (req, res, next) => {
  const { id } = req.params
  const treatment = await getTreatmentService(id)
  return res.status(200).json({ treatment })
}

exports.getTreatmentsByVisitController = async (req, res, next) => {
  const { visitId } = req.params
  const treatments = await getTreatmentsByVisitService(visitId)
  return res.status(200).json({ treatments })
}

exports.getUnbilledTreatmentsController = async (req, res, next) => {
  const { patientId } = req.params
  const treatments = await getUnbilledTreatmentsService(patientId)
  return res.status(200).json({ treatments })
}

exports.getAllTreatmentsByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  const treatments = await getAllTreatmentsByPatientService(patientId)
  return res.status(200).json({ treatments })
}

exports.createTreatmentController = async (req, res, next) => {
  const { visitId, treatmentPlanId, performedById, procedureCatalogId, procedure, toothNumber, notes, amount } = req.body
  const treatment = await createTreatmentService(
    { visitId, treatmentPlanId, performedById, procedureCatalogId, procedure, toothNumber, notes, amount },
    { id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] }
  )
  return res.status(201).json({ treatment })
}

exports.updateTreatmentController = async (req, res, next) => {
  const { id } = req.params
  const treatment = await updateTreatmentService(id, req.body, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ treatment })
}

exports.deleteTreatmentController = async (req, res, next) => {
  const { id } = req.params
  await deleteTreatmentService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  return res.status(200).json({ message: 'Treatment deleted successfully' })
}