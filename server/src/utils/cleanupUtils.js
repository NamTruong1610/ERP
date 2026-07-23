const { prisma } = require('../config/PrismaConfig')
const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { r2Client } = require('../config/R2Config')
const { createAuditLog } = require('../repositories/auditRepository')
const { AuditAction, ActorType, TargetType, TriggerType } = require('@prisma/client')
const { FILE_PURGE_RETENTION_MS } = require('../config/constants')

exports.cleanupExpiredUsers = async () => {
  // Find expired activations
  const expiredActivations = await prisma.userActivation.findMany({
    where: {
      expiresAt: { lt: new Date() }
    },
    select: { userId: true }
  })

  if (expiredActivations.length === 0) {
    console.log('Cleaned up 0 expired users')
    return
  }

  const expiredUserIds = expiredActivations.map(a => a.userId)

  // Delete the users — UserActivation cascades automatically
  const deleted = await prisma.user.deleteMany({
    where: {
      id: { in: expiredUserIds }
    }
  })

  console.log(`Cleaned up ${deleted.count} expired users`)
}

// Permanently deletes files that have been soft-deleted for longer than
// FILE_PURGE_RETENTION_MS — removes both the R2 object and the DB row.
// Only ever touches files where deletedAt is already set: purging a file
// that hasn't been soft-deleted first is not this job's job (see
// hardDeleteFileService for the same invariant on the manual/admin path).
exports.purgeExpiredSoftDeletedFiles = async () => {
  const cutoff = new Date(Date.now() - FILE_PURGE_RETENTION_MS)

  const expired = await prisma.file.findMany({
    where: {
      deletedAt: { not: null, lt: cutoff }
    },
    select: { id: true, storageKey: true, patientId: true, fileName: true, mimeType: true, sizeBytes: true }
  })

  if (expired.length === 0) {
    console.log('Purged 0 expired soft-deleted files')
    return { purged: 0 }
  }

  // Best-effort R2 cleanup — allSettled so one already-missing object
  // doesn't block purging the rest. DeleteObjectCommand is idempotent.
  await Promise.allSettled(
    expired.map(f =>
      r2Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: f.storageKey
      }))
    )
  )

  // Audit log written before the DB rows disappear — one entry per file,
  // attributed to the system rather than any user, so there's a permanent
  // record of what was purged and when even though the File row itself
  // is about to be gone.
  await prisma.$transaction(async (tx) => {
    for (const f of expired) {
      await createAuditLog({
        actorId: null,
        actorType: ActorType.SYSTEM,
        targetId: f.id,
        targetType: TargetType.FILE,
        action: AuditAction.FILE_PURGED,
        metadata: {
          patientId: f.patientId,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
        },
        trigger: TriggerType.SYSTEM,
      }, tx)
    }

    await tx.file.deleteMany({
      where: { id: { in: expired.map(f => f.id) } }
    })
  })

  console.log(`Purged ${expired.length} expired soft-deleted files`)
  return { purged: expired.length }
}