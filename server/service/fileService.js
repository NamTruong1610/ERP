// services/fileService.js
const {
  createPendingFile, findFileById, findAnyFileById,
  findFilesByPatientId, updateFileById, softDeleteFile, hardDeleteFile,
} = require('../repository/fileRepository');
const { findPatientById } = require('../repository/patientRepository');
const { createAuditLog } = require('../repository/auditRepository');
const { generateUploadUrl, generateDownloadUrl, objectExists, deleteObject } = require('../repository/r2Repository');
const { prisma } = require('../config/PrismaConfig');
const { AppError } = require('../utils/errorsUtil.js');
const { ActorType, AuditAction, TargetType, TriggerType, FileStatus } = require('@prisma/client');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'application/dicom'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

exports.getFilesByPatientService = async (patientId) => {
  const patient = await findPatientById(patientId);
  if (!patient) {
    throw new AppError('Patient not found', 404);
  }
  return findFilesByPatientId(patientId);
};

exports.preUploadFileService = async ({ patientId, fileName, mimeType, sizeBytes }, actor) => {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new AppError('File type not allowed', 400);
  }

  const parsedSize = parseInt(sizeBytes, 10);
  if (isNaN(parsedSize) || parsedSize <= 0) {
    throw new AppError('Invalid file size', 400);
  }
  if (parsedSize > MAX_SIZE_BYTES) {
    throw new AppError(`File exceeds ${MAX_SIZE_BYTES / (1024 * 1024)}MB limit`, 400);
  }

  const patientRecord = await findPatientById(patientId);
  if (!patientRecord) {
    throw new AppError('Patient not found', 404);
  }

  const storageKey = `patients/${patientId}/${Date.now()}_${fileName}`;

  const newPendingFile = await createPendingFile({
    patientId,
    uploadedBy: actor.id,
    fileName,
    mimeType,
    sizeBytes: parsedSize,
    storageKey,
  });

  const uploadUrl = await generateUploadUrl(storageKey, mimeType);

  return { uploadUrl, fileId: newPendingFile.id };
};

exports.confirmUploadFileService = async (fileId, actor) => {
  const fileRecord = await findFileById(fileId);
  if (!fileRecord) {
    throw new AppError('File not found', 404);
  }
  if (fileRecord.status !== FileStatus.PENDING) {
    throw new AppError('File already confirmed', 400);
  }

  const exists = await objectExists(fileRecord.storageKey);
  if (!exists) {
    throw new AppError('File not found in storage — upload may have failed', 400);
  }

  const updatedFile = await updateFileById(fileId, { status: FileStatus.CONFIRMED });

  await createAuditLog({
    actorId: actor.id,
    actorType: ActorType.USER,
    targetId: fileId,
    targetType: TargetType.FILE,
    action: AuditAction.FILE_UPLOADED,
    metadata: {
      patientId: fileRecord.patientId,
      fileName: fileRecord.fileName,
      mimeType: fileRecord.mimeType,
      sizeBytes: fileRecord.sizeBytes,
    },
    ip: actor.ip,
    userAgent: actor.userAgent,
    trigger: TriggerType.USER_ACTION,
  });

  return updatedFile;
};

exports.downloadFileService = async (fileId, actor) => {
  const fileRecord = await findFileById(fileId);
  if (!fileRecord || fileRecord.status !== FileStatus.CONFIRMED) {
    throw new AppError('File not found', 404);
  }

  const downloadUrl = await generateDownloadUrl(fileRecord.storageKey);

  await createAuditLog({
    actorId: actor.id,
    actorType: ActorType.USER,
    targetId: fileId,
    targetType: TargetType.FILE,
    action: AuditAction.FILE_DOWNLOADED,
    metadata: {
      patientId: fileRecord.patientId,
      fileName: fileRecord.fileName,
      mimeType: fileRecord.mimeType,
      sizeBytes: fileRecord.sizeBytes,
    },
    ip: actor.ip,
    userAgent: actor.userAgent,
    trigger: TriggerType.USER_ACTION,
  });

  return downloadUrl;
};

exports.softDeleteFileService = async (fileId, actor) => {
  const fileRecord = await findFileById(fileId);
  if (!fileRecord || fileRecord.status !== FileStatus.CONFIRMED) {
    throw new AppError('File not found', 404);
  }

  await prisma.$transaction(async (tx) => {
    await createAuditLog({
      actorId: actor.id,
      actorType: ActorType.USER,
      targetId: fileId,
      targetType: TargetType.FILE,
      action: AuditAction.FILE_DELETED,
      metadata: {
        patientId: fileRecord.patientId,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
      trigger: TriggerType.USER_ACTION,
    }, tx);
    await softDeleteFile(fileId, tx);
  });
};

exports.hardDeleteFileService = async (fileId, actor) => {
  const fileRecord = await findAnyFileById(fileId);
  if (!fileRecord) {
    throw new AppError('File not found', 404);
  }
  if (!fileRecord.deletedAt) {
    throw new AppError('File must be soft-deleted before it can be purged', 409);
  }

  await createAuditLog({
    actorId: actor.id,
    actorType: ActorType.USER,
    targetId: fileId,
    targetType: TargetType.FILE,
    action: AuditAction.FILE_PURGED,
    metadata: {
      patientId: fileRecord.patientId,
      fileName: fileRecord.fileName,
      mimeType: fileRecord.mimeType,
      sizeBytes: fileRecord.sizeBytes,
    },
    ip: actor.ip,
    userAgent: actor.userAgent,
    trigger: TriggerType.ADMIN_ACTION,
  });

  await deleteObject(fileRecord.storageKey);
  await hardDeleteFile(fileId);
};