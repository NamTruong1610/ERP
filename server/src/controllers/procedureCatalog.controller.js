import * as procedureCatalogService from '../services/procedureCatalog.service.js';
const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

export const getAllProceduresController = async (req, res, next) => {
  const result = await procedureCatalogService.getAllProceduresService(req.query)
  return res.status(200).json(result)
}

export const getProcedureController = async (req, res, next) => {
  const procedure = await procedureCatalogService.getProcedureService(req.params.id)
  return res.status(200).json({ procedure })
}

export const createProcedureController = async (req, res, next) => {
  const procedure = await procedureCatalogService.createProcedureService(req.body, actorFrom(req))
  return res.status(201).json({ procedure })
}

export const updateProcedureController = async (req, res, next) => {
  const procedure = await procedureCatalogService.updateProcedureService(req.params.id, req.body, actorFrom(req))
  return res.status(200).json({ procedure })
}

export const deactivateProcedureController = async (req, res, next) => {
  const procedure = await procedureCatalogService.deactivateProcedureService(req.params.id, actorFrom(req))
  return res.status(200).json({ procedure })
}

export const reactivateProcedureController = async (req, res, next) => {
  const procedure = await procedureCatalogService.reactivateProcedureService(req.params.id, actorFrom(req))
  return res.status(200).json({ procedure })
}