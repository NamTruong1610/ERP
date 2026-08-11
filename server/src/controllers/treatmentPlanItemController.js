const {
  createTreatmentPlanItemService,
  editTreatmentPlanItemService,
  relocateTreatmentPlanItemService,
  removeTreatmentPlanItemService
} = require('../services/treatmentPlanItemService')

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

exports.createTreatmentPlanItemController = async (req, res, next) => {
  const { procedure, toothNumber, estimatedAmount } = req.body
  const treatmentPlanItem = await createTreatmentPlanItemService({
    treatmentPlanId: req.params.id,
    procedure,
    toothNumber,
    estimatedAmount
  }, actorFrom(req))
  return res.status(201).json({ treatmentPlanItem })
}

exports.editTreatmentPlanItemController = async (req, res, next) => {
  const { procedure, toothNumber, estimatedAmount } = req.body
  const treatmentPlanItem = await editTreatmentPlanItemService({
    itemId: req.params.itemId,
    procedure,
    toothNumber,
    estimatedAmount
  }, actorFrom(req))
  return res.status(200).json({ treatmentPlanItem })
}

exports.relocateTreatmentPlanItemController = async (req, res, next) => {
  const treatmentPlanItem = await relocateTreatmentPlanItemService({
    itemId: req.params.itemId,
    treatmentPlanId: req.body.treatmentPlanId
  }, actorFrom(req))
  return res.status(200).json({ treatmentPlanItem })
}

exports.removeTreatmentPlanItemController = async (req, res, next) => {
  await removeTreatmentPlanItemService({ itemId: req.params.itemId }, actorFrom(req))
  return res.status(204).send()
}