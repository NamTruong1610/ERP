const {
  getMyStatsService,
  getClinicStatsService,
  getSystemStatsService
} = require('../services/statsService')

const { AppError } = require('../utils/errorsUtil.js');

exports.getMyStatsController = async (req, res, next) => {
  try {
    const stats = await getMyStatsService(req.user.id)
    return res.status(200).json(stats)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getClinicStatsController = async (req, res, next) => {
  try {
    const stats = await getClinicStatsService()
    return res.status(200).json(stats)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}

exports.getSystemStatsController = async (req, res, next) => {
  try {
    const stats = await getSystemStatsService()
    return res.status(200).json(stats)
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error)
  }
}