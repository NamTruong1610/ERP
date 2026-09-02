import * as treatmentPlanService from '../services/treatmentPlan.service.js';
const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

export const getAllTreatmentPlansController = async (req, res, next) => {
  const result = await treatmentPlanService.getAllTreatmentPlansService(req.query)
  return res.status(200).json(result)
}

export const getTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await treatmentPlanService.getTreatmentPlanService(req.params.id)
  return res.status(200).json({ treatmentPlan })
}

export const createTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await treatmentPlanService.createTreatmentPlanService(req.body, actorFrom(req))
  return res.status(201).json({ treatmentPlan })
}

export const addTreatmentPlanItemsBulkController = async (req, res, next) => {
  const items = await treatmentPlanService.addTreatmentPlanItemsBulkService(req.params.id, req.body, actorFrom(req))
  return res.status(201).json({ items })
}

export const attachTreatmentsToTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await treatmentPlanService.attachTreatmentsToTreatmentPlanService(req.params.id, req.body.treatmentIds, actorFrom(req))
  return res.status(200).json({ treatmentPlan })
}

export const updateTreatmentPlanController = async (req, res, next) => {
  const treatmentPlan = await treatmentPlanService.updateTreatmentPlanService(req.params.id, req.body, actorFrom(req))
  return res.status(200).json({ treatmentPlan })
}