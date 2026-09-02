import * as treatmentPlanItemService from '../services/treatmentPlanItem.service.js';
const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

export const createTreatmentPlanItemController = async (req, res, next) => {
  const { procedure, toothNumber, estimatedAmount } = req.body
  const treatmentPlanItem = await treatmentPlanItemService.createTreatmentPlanItemService({
    treatmentPlanId: req.params.id,
    procedure,
    toothNumber,
    estimatedAmount
  }, actorFrom(req))
  return res.status(201).json({ treatmentPlanItem })
}

export const editTreatmentPlanItemController = async (req, res, next) => {
  const { procedure, toothNumber, estimatedAmount } = req.body
  const treatmentPlanItem = await treatmentPlanItemService.editTreatmentPlanItemService({
    itemId: req.params.itemId,
    procedure,
    toothNumber,
    estimatedAmount
  }, actorFrom(req))
  return res.status(200).json({ treatmentPlanItem })
}

export const relocateTreatmentPlanItemController = async (req, res, next) => {
  const treatmentPlanItem = await treatmentPlanItemService.relocateTreatmentPlanItemService({
    itemId: req.params.itemId,
    treatmentPlanId: req.body.treatmentPlanId
  }, actorFrom(req))
  return res.status(200).json({ treatmentPlanItem })
}

export const removeTreatmentPlanItemController = async (req, res, next) => {
  await treatmentPlanItemService.removeTreatmentPlanItemService({ itemId: req.params.itemId }, actorFrom(req))
  return res.status(204).send()
}