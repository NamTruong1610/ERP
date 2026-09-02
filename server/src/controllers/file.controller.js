import * as fileService from '../services/file.service.js';
export const getFilesByPatientController = async (req, res, next) => {
  const files = await fileService.getFilesByPatientService(req.params.patientId);
  return res.status(200).json({ files });
};

export const preUploadFileController = async (req, res, next) => {
  const { patientId } = req.params;
  const { fileName, mimeType, sizeBytes } = req.body;

  const result = await fileService.preUploadFileService({ patientId, fileName, mimeType, sizeBytes }, {
    id: req.user.id,
  });
  return res.status(200).json(result);
};

export const confirmUploadFileController = async (req, res, next) => {
  const file = await fileService.confirmUploadFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ file });
};

export const downloadFileController = async (req, res, next) => {
  const downloadUrl = await fileService.downloadFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ downloadUrl });
};

export const softDeleteFileController = async (req, res, next) => {
  await fileService.softDeleteFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'File deleted successfully' });
};

export const hardDeleteFileController = async (req, res, next) => {
  await fileService.hardDeleteFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'File permanently deleted' });
};