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
  try {
    const result = await getAuditLogsService(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// controller
exports.revokeSessionController = async (req, res, next) => {
  const { sessionId } = req.params;
  try {
    await revokeSessionService(sessionId, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ message: 'Session revoked successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

// controller
exports.revokeAllSessionsController = async (req, res, next) => {
  try {
    const result = await revokeAllSessionsService({
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ message: 'All sessions revoked successfully', ...result });
  } catch (error) {
    next(error);
  }
};

// controller
exports.restoreUserController = async (req, res, next) => {
  const { id } = req.params;
  try {
    await restoreUserService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ message: 'User restored successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

// controller
exports.purgeUserController = async (req, res, next) => {
  const { id } = req.params;
  try {
    await purgeUserService(id, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ message: 'User permanently deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.getDeletedUsersController = async (req, res, next) => {
  try {
    const users = await getAllDeletedUsersService()
    return res.status(200).json({ users })
  } catch (error) {
    next(error)
  }
}

exports.getAllSessionsController = async (req, res, next) => {
  try {
    const sessions = await getAllActiveSessionsService()
    return res.status(200).json({ sessions })
  } catch (error) {
    next(error)
  }
}