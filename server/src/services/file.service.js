// services/fileService.js
import * as fileRepository from '../repositories/file.repository.js';
import * as patientRepository from '../repositories/patient.repository.js';
import * as auditRepository from '../repositories/audit.repository.js';
import * as r2Repository from '../repositories/r2.repository.js';
import * as prismaConfig from '../config/prisma.config.js';
import * as appError from '../lib/AppError.js';
import { ActorType, AuditAction, TargetType, TriggerType, FileStatus } from '@prisma/client';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'application/dicom'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export const getFilesByPatientService = async (patientId) => {
  const patient = await patientRepository.findPatientById(patientId);
  if (!patient) {
    throw new appError.AppError('Patient not found', 404);
  }
  return fileRepository.findFilesByPatientId(patientId);
};

export const preUploadFileService = async ({ patientId, fileName, mimeType, sizeBytes }, actor) => {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new appError.AppError('File type not allowed', 400);
  }

  const parsedSize = parseInt(sizeBytes, 10);
  if (isNaN(parsedSize) || parsedSize <= 0) {
    throw new appError.AppError('Invalid file size', 400);
  }
  if (parsedSize > MAX_SIZE_BYTES) {
    throw new appError.AppError(`File exceeds ${MAX_SIZE_BYTES / (1024 * 1024)}MB limit`, 400);
  }

  const patientRecord = await patientRepository.findPatientById(patientId);
  if (!patientRecord) {
    throw new appError.AppError('Patient not found', 404);
  }

  const storageKey = `patients/${patientId}/${Date.now()}_${fileName}`;

  const newPendingFile = await fileRepository.createPendingFile({
    patientId,
    uploadedBy: actor.id,
    fileName,
    mimeType,
    sizeBytes: parsedSize,
    storageKey,
  });

  const uploadUrl = await r2Repository.generateUploadUrl(storageKey, mimeType);

  return { uploadUrl, fileId: newPendingFile.id };
};

export const confirmUploadFileService = async (fileId, actor) => {
  const fileRecord = await fileRepository.findFileById(fileId);
  if (!fileRecord) {
    throw new appError.AppError('File not found', 404);
  }
  if (fileRecord.status !== FileStatus.PENDING) {
    throw new appError.AppError('File already confirmed', 400);
  }

  const exists = await r2Repository.objectExists(fileRecord.storageKey);
  if (!exists) {
    throw new appError.AppError('File not found in storage — upload may have failed', 400);
  }

  const updatedFile = await fileRepository.updateFileById(fileId, { status: FileStatus.CONFIRMED });

  await auditRepository.createAuditLog({
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

export const downloadFileService = async (fileId, actor) => {
  const fileRecord = await fileRepository.findFileById(fileId);
  if (!fileRecord || fileRecord.status !== FileStatus.CONFIRMED) {
    throw new appError.AppError('File not found', 404);
  }

  const downloadUrl = await r2Repository.generateDownloadUrl(fileRecord.storageKey);

  await auditRepository.createAuditLog({
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

export const softDeleteFileService = async (fileId, actor) => {
  const fileRecord = await fileRepository.findFileById(fileId);
  if (!fileRecord || fileRecord.status !== FileStatus.CONFIRMED) {
    throw new appError.AppError('File not found', 404);
  }

  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
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
    await fileRepository.softDeleteFile(fileId, tx);
  });
};

export const hardDeleteFileService = async (fileId, actor) => {
  const fileRecord = await fileRepository.findAnyFileById(fileId);
  if (!fileRecord) {
    throw new appError.AppError('File not found', 404);
  }
  if (!fileRecord.deletedAt) {
    throw new appError.AppError('File must be soft-deleted before it can be purged', 409);
  }

  // R2 delete goes first — it's the external, network-dependent step, and
  // it's safe to retry (deleting an already-missing key is a no-op success).
  // A crash here just means "retry the purge"; nothing has been recorded yet.
  await r2Repository.deleteObject(fileRecord.storageKey);

  await prismaConfig.prisma.$transaction(async (tx) => {
    await auditRepository.createAuditLog({
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
    }, tx);
    await fileRepository.hardDeleteFile(fileId, tx);
  });
};