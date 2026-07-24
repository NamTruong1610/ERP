const {
  getFilesByPatientService,
  preUploadFileService,
  confirmUploadFileService,
  downloadFileService,
  softDeleteFileService,
  hardDeleteFileService
} = require('../services/fileService')

exports.getFilesByPatientController = async (req, res, next) => {
  const files = await getFilesByPatientService(req.params.patientId);
  return res.status(200).json({ files });
};

exports.preUploadFileController = async (req, res, next) => {
  const { patientId } = req.params;
  const { fileName, mimeType, sizeBytes } = req.body;

  const result = await preUploadFileService({ patientId, fileName, mimeType, sizeBytes }, {
    id: req.user.id,
  });
  return res.status(200).json(result);
};

exports.confirmUploadFileController = async (req, res, next) => {
  const file = await confirmUploadFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ file });
};

exports.downloadFileController = async (req, res, next) => {
  const downloadUrl = await downloadFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ downloadUrl });
};

exports.softDeleteFileController = async (req, res, next) => {
  await softDeleteFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'File deleted successfully' });
};

exports.hardDeleteFileController = async (req, res, next) => {
  await hardDeleteFileService(req.params.fileId, {
    id: req.user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.status(200).json({ message: 'File permanently deleted' });
};