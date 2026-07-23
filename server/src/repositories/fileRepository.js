const { prisma } = require('../config/PrismaConfig')

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
