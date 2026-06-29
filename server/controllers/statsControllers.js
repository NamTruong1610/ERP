const {
  getMyStats,
  getClinicStats,
  getSystemStats
} = require('../services/statsServices')

exports.getMyStatsController = async (req, res, next) => {
  try {
    const stats = await getMyStats(req.user.id)
    return res.status(200).json(stats)
  } catch (error) {
    next(error)
  }
}

exports.getClinicStatsController = async (req, res, next) => {
  try {
    const stats = await getClinicStats()
    return res.status(200).json(stats)
  } catch (error) {
    next(error)
  }
}

exports.getSystemStatsController = async (req, res, next) => {
  try {
    const stats = await getSystemStats()
    return res.status(200).json(stats)
  } catch (error) {
    next(error)
  }
}