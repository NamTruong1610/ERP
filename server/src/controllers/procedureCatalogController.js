const {
  getAllProceduresService,
  getProcedureService,
  createProcedureService,
  updateProcedureService,
  deactivateProcedureService,
  reactivateProcedureService
} = require('../services/procedureCatalogService')

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

exports.getAllProceduresController = async (req, res, next) => {
  const result = await getAllProceduresService(req.query)
  return res.status(200).json(result)
}

exports.getProcedureController = async (req, res, next) => {
  const procedure = await getProcedureService(req.params.id)
  return res.status(200).json({ procedure })
}

exports.createProcedureController = async (req, res, next) => {
  const procedure = await createProcedureService(req.body, actorFrom(req))
  return res.status(201).json({ procedure })
}

exports.updateProcedureController = async (req, res, next) => {
  const procedure = await updateProcedureService(req.params.id, req.body, actorFrom(req))
  return res.status(200).json({ procedure })
}

exports.deactivateProcedureController = async (req, res, next) => {
  const procedure = await deactivateProcedureService(req.params.id, actorFrom(req))
  return res.status(200).json({ procedure })
}

exports.reactivateProcedureController = async (req, res, next) => {
  const procedure = await reactivateProcedureService(req.params.id, actorFrom(req))
  return res.status(200).json({ procedure })
}