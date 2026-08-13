const {
  getAllTreatmentPlansService,
  getTreatmentPlanService,
  createTreatmentPlanService,
  updateTreatmentPlanService, 
  addTreatmentPlanItemsBulkService,
  attachTreatmentsToTreatmentPlanService
} = require('../services/treatmentPlanService')

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

exports.getAllTreatmentPlansController = async (req, res, next) => {
  const result = await getAllTreatmentPlansService(req.query)
  return res.status(200).json(result)
}

exports.getTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await getTreatmentPlanService(req.params.id)
  return res.status(200).json({ treatmentPlan })
}

exports.createTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await createTreatmentPlanService(req.body, actorFrom(req))
  return res.status(201).json({ treatmentPlan })
}

exports.addTreatmentPlanItemsBulkController = async (req, res, next) => {
  const items = await addTreatmentPlanItemsBulkService(req.params.id, req.body, actorFrom(req))
  return res.status(201).json({ items })
}

exports.attachTreatmentsToTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await attachTreatmentsToTreatmentPlanService(req.params.id, req.body.treatmentIds, actorFrom(req))
  return res.status(200).json({ treatmentPlan })
}

exports.updateTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await updateTreatmentPlanService(req.params.id, req.body, actorFrom(req))
  return res.status(200).json({ treatmentPlan })
}