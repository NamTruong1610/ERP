import * as systemService from "../services/system.service.js";

export const getAuditLogsController = async (req, res, next) => {
  const result = await systemService.getAuditLogsService(req.query);
  return res.status(200).json(result);
};

// controller
export const revokeSessionController = async (req, res, next) => {
  const { sessionId } = req.params;
  await systemService.revokeSessionService(sessionId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'Session revoked successfully' });
};

// controller
export const revokeAllSessionsController = async (req, res, next) => {
  const result = await systemService.revokeAllSessionsService({
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'All sessions revoked successfully', ...result });
};

// controller
export const restoreUserController = async (req, res, next) => {
  const { id } = req.params;
  await systemService.restoreUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'User restored successfully' });
};

// controller
export const purgeUserController = async (req, res, next) => {
  const { id } = req.params;
  await systemService.purgeUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'User permanently deleted' });
};

export const getDeletedUsersController = async (req, res, next) => {
  const users = await systemService.getAllDeletedUsersService()
  return res.status(200).json({ users })
}

export const getAllSessionsController = async (req, res, next) => {
  const sessions = await systemService.getAllActiveSessionsService()
  return res.status(200).json({ sessions })
}