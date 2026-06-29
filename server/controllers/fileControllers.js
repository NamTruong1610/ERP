const {
  findAllPatients,
  findPatientById,
  createPatient,
  updatePatient,
  softDeletePatient
} = require('../services/patientService')

const {
  createPendingFile,
  findFileById,
  findAnyFileById,
  findFilesByPatientId,
  updateFileById,
  softDeleteFile,
  hardDeleteFile
} = require('../services/fileServices')

const { createAuditLog } = require('../services/auditServices')

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { r2Client } = require("../config/R2Config")
const { prisma } = require('../config/PrismaConfig')

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'application/dicom']
const MAX_SIZE_BYTES = 20 * 1024 * 1024  // 20MB
const UPLOAD_PRESIGNED_URL_EXPIRE_IN_MINUTES = 5 * 60
const DOWNLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS = 60

const { ActorType, AuditAction, TargetType, TriggerType, FileStatus } = require('@prisma/client')

exports.getFilesByPatientController = async (req, res, next) => {
  const { patientId } = req.params
  try {
    const patient = await findPatientById(patientId)
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' })
    }

    const files = await findFilesByPatientId(patientId)
    return res.status(200).json({ files })
  } catch (error) {
    next(error)
  }
}

// 1. Client sends { patientId, fileName, mimeType, sizeBytes } to server
// 2. Server validates — patient exists, RBAC, file type allowed, size within limit
// 3. Server generates storageKey (cuid — never the original filename)
// 4. Server writes a PENDING File record to Postgres
// 5. Server generates a presigned UPLOAD URL from R2 (valid 5 mins)
// 6. Server returns { uploadUrl, fileId } to client
// 7. Client uploads file bytes directly to R2 using uploadUrl
// 8. Client notifies server POST /files/:id/confirm
// 9. Server verifies the file exists in R2
// 10. Server updates File record status PENDING → CONFIRMED
// 11. Server writes audit log

exports.preUploadFileController = async (req, res, next) => {
  const { patientId } = req.params
  const { fileName, mimeType, sizeBytes } = req.body
  try {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ message: 'File type not allowed' })
    }
    if (parseInt(sizeBytes) > MAX_SIZE_BYTES) {
      return res.status(400).json({ message: `File exceeds ${MAX_SIZE_BYTES / (1024 * 1024)}MB limit` })
    }
    const patientRecord = await findPatientById(patientId)

    if (!patientRecord) {
      return res.status(404).json({
        message: 'Patient not found'
      })
    }

    // Generate presigned url in R2
    const storageKey = `patients/${patientId}/${Date.now()}_${fileName}`

    // Write pending file record to Postgres
    const newPendingFile = await createPendingFile({
      patientId,
      uploadedBy: req.user.id,
      fileName,
      mimeType,
      sizeBytes,
      storageKey,
    })

    const uploadUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: storageKey,
        ContentType: mimeType,
      }),
      { expiresIn: UPLOAD_PRESIGNED_URL_EXPIRE_IN_MINUTES }
    );

    return res.status(200).json({
      uploadUrl,
      fileId: newPendingFile.id
    })
  } catch (error) {
    next(error)
  }
}

exports.confirmUploadFileController = async (req, res, next) => {
  const { fileId } = req.params
  try {
    const fileRecord = await findFileById(fileId)

    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found' })
    }

    if (fileRecord.status !== FileStatus.PENDING) {
      return res.status(400).json({ message: 'File already confirmed' })
    }

    // Verify file's existence in R2
    try {
      await r2Client.send(new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileRecord.storageKey
      }))
      // reaches here = file exists in R2
    } catch (err) {
      // reaches here = file doesn't exist in R2
      return res.status(400).json({ message: 'File not found in storage — upload may have failed' })
    }

    // Update file status
    const updatedFile = await updateFileById(fileId, {
      status: FileStatus.CONFIRMED
    })

    // Audit log
    await createAuditLog({
      actorId: req.user.id,
      actorType: ActorType.USER,
      targetId: fileId,
      targetType: TargetType.FILE,
      action: AuditAction.FILE_UPLOADED,
      metadata: {
        patientId: fileRecord.patientId,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      trigger: TriggerType.USER_ACTION
    })

    return res.status(200).json({ file: updatedFile })


  } catch (error) {
    next(error)
  }
}

// 1. Client sends GET /files/:fileId/download to server
// 2. Server validates — requireAuth, RBAC (FILES_READ)
// 3. Server looks up File record by fileId
//    — must exist, status CONFIRMED, deletedAt null
// 4. Server generates a presigned download URL from R2 using storageKey
//    — valid 60 seconds
// 5. Server writes audit log (FILE_DOWNLOADED)
// 6. Server returns { url } to client
// 7. Client opens the presigned URL directly
//    — browser downloads file bytes from R2, server not involved
exports.downloadFileController = async (req, res, next) => {
  const { fileId } = req.params
  try {
    const fileRecord = await findFileById(fileId)

    if (!fileRecord || fileRecord.status !== FileStatus.CONFIRMED) { return res.status(400).json({ message: 'File not found' }) }

    const downloadUrl = await getSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileRecord.storageKey,
      }),
      { expiresIn: DOWNLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS }
    )

    // Audit log
    await createAuditLog({
      actorId: req.user.id,
      actorType: ActorType.USER,
      targetId: fileId,
      targetType: TargetType.FILE,
      action: AuditAction.FILE_DOWNLOADED,
      metadata: {
        patientId: fileRecord.patientId,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      trigger: TriggerType.USER_ACTION
    })

    return res.status(200).json({ downloadUrl })

  } catch (error) {
    next(error)
  }
}

// 1. Client sends DELETE /files/:fileId to server
// 2. Server validates — requireAuth, RBAC (FILES_DELETE)
// 3. Server looks up File record by fileId
//    — must exist, status CONFIRMED, deletedAt null
// 4. Server writes audit log (FILE_DELETED) — write-ahead
// 5. Server sets deletedAt = now() on the File record
//    — steps 4 and 5 inside one transaction
// 6. File record is now invisible to all normal queries
//    — R2 object still exists until purged
// 7. Server returns { message: 'File deleted successfully' }

exports.softDeleteFileController = async (req, res, next) => {
  const { fileId } = req.params
  try {
    const fileRecord = await findFileById(fileId)

    if (!fileRecord || fileRecord.status !== FileStatus.CONFIRMED) { return res.status(400).json({ message: 'File not found' }) }

    // Audit log
    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorId: req.user.id,
        actorType: ActorType.USER,
        targetId: fileId,
        targetType: TargetType.FILE,
        action: AuditAction.FILE_DELETED,
        metadata: {
          patientId: fileRecord.patientId,
          fileName: fileRecord.fileName,
          mimeType: fileRecord.mimeType,
          sizeBytes: fileRecord.sizeBytes
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        trigger: TriggerType.USER_ACTION
      }, tx)
      await softDeleteFile(fileId, tx)
    })

    return res.status(200).json({ message: 'File deleted successfully' })

  } catch (error) {
    next(error)
  }
}

// 1. Client sends DELETE /files/:fileId/purge to server
// 2. Server validates — requireAuth, RBAC (FILES_PURGE)
// 3. Server looks up File record by fileId
//    — must exist (any status, including soft-deleted)
// 4. Server writes audit log (FILE_PURGED) — write-ahead
// 5. Server sends DeleteObjectCommand to R2 using storageKey
//    — removes file bytes from storage permanently
// 6. Server hard deletes the File record from Postgres
// 7. Server returns { message: 'File permanently deleted' }
exports.hardDeleteFileController = async (req, res, next) => {
  const { fileId } = req.params
  try {
    const fileRecord = await findAnyFileById(fileId)

    if (!fileRecord) { return res.status(400).json({ message: 'File not found' }) }

    // Audit log
    await createAuditLog({
      actorId: req.user.id,
      actorType: ActorType.USER,
      targetId: fileId,
      targetType: TargetType.FILE,
      action: AuditAction.FILE_PURGED,
      metadata: {
        patientId: fileRecord.patientId,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      trigger: TriggerType.ADMIN_ACTION
    })

    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileRecord.storageKey
    }))

    await hardDeleteFile(fileId)

    return res.status(200).json({ message: 'File permanently deleted' })

  } catch (error) {
    next(error)
  }
}