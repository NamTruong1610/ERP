const {
  getAuditLogsService,
  revokeSessionService,
  revokeAllSessionsService,
  restoreUserService,
  purgeUserService,
  getAllActiveSessionsService,
  getAllDeletedUsersService
} = require("../services/systemService");

exports.getAuditLogsController = async (req, res, next) => {
  const result = await getAuditLogsService(req.query);
  return res.status(200).json(result);
};

// controller
exports.revokeSessionController = async (req, res, next) => {
  const { sessionId } = req.params;
  await revokeSessionService(sessionId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'Session revoked successfully' });
};

// controller
exports.revokeAllSessionsController = async (req, res, next) => {
  const result = await revokeAllSessionsService({
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'All sessions revoked successfully', ...result });
};

// controller
exports.restoreUserController = async (req, res, next) => {
  const { id } = req.params;
  await restoreUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'User restored successfully' });
};

// controller
exports.purgeUserController = async (req, res, next) => {
  const { id } = req.params;
  await purgeUserService(id, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'User permanently deleted' });
};

exports.getDeletedUsersController = async (req, res, next) => {
  const users = await getAllDeletedUsersService()
  return res.status(200).json({ users })
}

exports.getAllSessionsController = async (req, res, next) => {
  const sessions = await getAllActiveSessionsService()
  return res.status(200).json({ sessions })
}