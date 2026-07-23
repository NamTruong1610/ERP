const {
  getFilesByPatientService,
  preUploadFileService,
  confirmUploadFileService,
  downloadFileService,
  softDeleteFileService,
  hardDeleteFileService
} = require('../service/fileService')

const { AppError } = require('../utils/errorsUtil.js');

exports.getFilesByPatientController = async (req, res, next) => {
  try {
    const files = await getFilesByPatientService(req.params.patientId);
    return res.status(200).json({ files });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
};

exports.preUploadFileController = async (req, res, next) => {
  const { patientId } = req.params;
  const { fileName, mimeType, sizeBytes } = req.body;
  try {
    const result = await preUploadFileService({ patientId, fileName, mimeType, sizeBytes }, {
      id: req.user.id,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
};

exports.confirmUploadFileController = async (req, res, next) => {
  try {
    const file = await confirmUploadFileService(req.params.fileId, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ file });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
};

exports.downloadFileController = async (req, res, next) => {
  try {
    const downloadUrl = await downloadFileService(req.params.fileId, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ downloadUrl });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
};

exports.softDeleteFileController = async (req, res, next) => {
  try {
    await softDeleteFileService(req.params.fileId, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
};

exports.hardDeleteFileController = async (req, res, next) => {
  try {
    await hardDeleteFileService(req.params.fileId, {
      id: req.user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(200).json({ message: 'File permanently deleted' });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
};