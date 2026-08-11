const {
  getAllVisitsService,
  getVisitService,
  createVisitFromAppointmentService,
  createWalkInVisitService,
  updateVisitService,
  addVisitProviderService,
  editVisitProviderRoleService,
  removeVisitProviderService,
  deleteVisitService
} = require('../services/visitService')

const actorFrom = (req) => ({ id: req.user.id, ip: req.ip, userAgent: req.headers['user-agent'] })

exports.getAllVisitsController = async (req, res, next) => {
  const result = await getAllVisitsService(req.query)
  return res.status(200).json(result)
}

exports.getVisitController = async (req, res, next) => {
  const visit = await getVisitService(req.params.id)
  return res.status(200).json({ visit })
}

exports.createVisitFromAppointmentController = async (req, res, next) => {
  const { appointmentId, visitDate, notes, providers } = req.body
  const visit = await createVisitFromAppointmentService({ appointmentId, visitDate, notes, providers }, actorFrom(req))
  return res.status(201).json({ visit })
}

exports.createWalkInVisitController = async (req, res, next) => {
  const { patientId, visitDate, notes, providers } = req.body
  const visit = await createWalkInVisitService({ patientId, visitDate, notes, providers }, actorFrom(req))
  return res.status(201).json({ visit })
}

exports.updateVisitController = async (req, res, next) => {
  const { notes, status } = req.body
  const visit = await updateVisitService(req.params.id, { notes, status }, actorFrom(req))
  return res.status(200).json({ visit })
}

exports.addVisitProviderController = async (req, res, next) => {
  const { performerId, role } = req.body
  const provider = await addVisitProviderService(req.params.id, { performerId, role }, actorFrom(req))
  return res.status(201).json({ provider })
}

exports.editVisitProviderRoleController = async (req, res, next) => {
  const { role } = req.body
  const provider = await editVisitProviderRoleService(req.params.id, req.params.providerId, { role }, actorFrom(req))
  return res.status(200).json({ provider })
}

exports.removeVisitProviderController = async (req, res, next) => {
  await removeVisitProviderService(req.params.id, req.params.providerId, actorFrom(req))
  return res.status(204).send()
}

exports.deleteVisitController = async (req, res, next) => {
  const { confirm } = req.body
  await deleteVisitService(req.params.id, { confirm }, actorFrom(req))
  return res.status(204).send()
}