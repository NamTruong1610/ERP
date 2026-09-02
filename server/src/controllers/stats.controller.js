import * as statsService from '../services/stats.service.js';
export const getMyStatsController = async (req, res) => {
  const stats = await statsService.getMyStatsService(req.user.id);
  return res.status(200).json({ stats });
};

export const getClinicStatsController = async (req, res, next) => {
  const stats = await statsService.getClinicStatsService()
  return res.status(200).json(stats)
}

export const getSystemStatsController = async (req, res, next) => {
  const stats = await statsService.getSystemStatsService()
  return res.status(200).json(stats)
}