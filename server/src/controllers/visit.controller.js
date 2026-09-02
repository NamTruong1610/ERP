import * as visitService from '../services/visit.service.js';
const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

export const getAllVisitsController = async (req, res, next) => {
  const result = await visitService.getAllVisitsService(req.query)
  return res.status(200).json(result)
}

export const getVisitController = async (req, res, next) => {
  const visit = await visitService.getVisitService(req.params.id)
  return res.status(200).json({ visit })
}

export const createVisitFromAppointmentController = async (req, res, next) => {
  const { appointmentId, visitDate, notes, providers } = req.body
  const visit = await visitService.createVisitFromAppointmentService({ appointmentId, visitDate, notes, providers }, actorFrom(req))
  return res.status(201).json({ visit })
}

export const createWalkInVisitController = async (req, res, next) => {
  const { patientId, visitDate, notes, providers } = req.body
  const visit = await visitService.createWalkInVisitService({ patientId, visitDate, notes, providers }, actorFrom(req))
  return res.status(201).json({ visit })
}

export const updateVisitController = async (req, res, next) => {
  const { notes, status } = req.body
  const visit = await visitService.updateVisitService(req.params.id, { notes, status }, actorFrom(req))
  return res.status(200).json({ visit })
}

export const addVisitProviderController = async (req, res, next) => {
  const { performerId, role } = req.body
  const provider = await visitService.addVisitProviderService(req.params.id, { performerId, role }, actorFrom(req))
  return res.status(201).json({ provider })
}

export const editVisitProviderRoleController = async (req, res, next) => {
  const { role } = req.body
  const provider = await visitService.editVisitProviderRoleService(req.params.id, req.params.providerId, { role }, actorFrom(req))
  return res.status(200).json({ provider })
}

export const removeVisitProviderController = async (req, res, next) => {
  await visitService.removeVisitProviderService(req.params.id, req.params.providerId, actorFrom(req))
  return res.status(204).send()
}

export const deleteVisitController = async (req, res, next) => {
  const { confirm } = req.body
  await visitService.deleteVisitService(req.params.id, { confirm }, actorFrom(req))
  return res.status(204).send()
}