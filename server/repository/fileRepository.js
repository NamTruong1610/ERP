const { prisma } = require('../config/PrismaConfig')
const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { r2Client } = require('../config/R2Config')

const getFileType = (mimeType) => {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('dicom')) return 'DICOM'
  if (mimeType.includes('image')) return 'IMAGE'
}

// File upload services
exports.createPendingFile = async (data, client = prisma) => {
  const fileType = getFileType(data.mimeType)
  return await client.file.create({
    data: {
      ...data,
      fileType
    }
  })
}

exports.findFileById = async (id, client = prisma) => {
  return await client.file.findFirst({
    where: { id, deletedAt: null }
  })
}

exports.findAnyFileById = async (id, client = prisma) => {
  return await client.file.findFirst({
    where: { id }
  })
}

exports.findFilesByPatientId = async (patientId, client = prisma) => {
  return await client.file.findMany({
    where: {
      patientId,
      status:    'CONFIRMED',
      deletedAt: null
    },
    orderBy: { createdAt: 'desc' }
  })
}

exports.updateFileById = async (id, data, client = prisma) => {
  return await client.file.update({
    where: { id },
    data
  })
}

// File delete services
exports.softDeleteFile = async (id, client = prisma) => {
  return await client.file.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

exports.hardDeleteFile = async (id, client = prisma) => {
  return await client.file.delete({
    where: { id }
  })
}

exports.cleanupPendingUploads = async () => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000)  // 10 minutes ago

  const stale = await prisma.file.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff }
    },
    select: { id: true, storageKey: true }
  })

  if (stale.length === 0) return { cleaned: 0 }

  // Attempt R2 cleanup — allSettled so one missing key doesn't
  // block the rest. DeleteObjectCommand is idempotent — safe if
  // the object never made it to R2
  await Promise.allSettled(
    stale.map(f =>
      r2Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: f.storageKey
      }))
    )
  )

  await prisma.file.deleteMany({
    where: { id: { in: stale.map(f => f.id) } }
  })

  console.log(`Cleaned up ${stale.length} stale pending file uploads`)
  return { cleaned: stale.length }
}