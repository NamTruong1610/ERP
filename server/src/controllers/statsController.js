const {
  getMyStatsService,
  getClinicStatsService,
  getSystemStatsService
} = require('../services/statsService')

exports.getMyStatsController = async (req, res) => {
  const stats = await getMyStatsService(req.user.id);
  return res.status(200).json({ stats });
};

exports.getClinicStatsController = async (req, res, next) => {
  const stats = await getClinicStatsService()
  return res.status(200).json(stats)
}

exports.getSystemStatsController = async (req, res, next) => {
  const stats = await getSystemStatsService()
  return res.status(200).json(stats)
}