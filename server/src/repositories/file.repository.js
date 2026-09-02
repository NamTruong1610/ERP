import * as prismaConfig from '../config/prisma.config.js';
const getFileType = (mimeType) => {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('dicom')) return 'DICOM'
  if (mimeType.includes('image')) return 'IMAGE'
}

// File upload services
export const createPendingFile = async (data, client = prismaConfig.prisma) => {
  const fileType = getFileType(data.mimeType)
  return await client.file.create({
    data: {
      ...data,
      fileType
    }
  })
}

export const findFileById = async (id, client = prismaConfig.prisma) => {
  return await client.file.findFirst({
    where: { id, deletedAt: null }
  })
}

export const findAnyFileById = async (id, client = prismaConfig.prisma) => {
  return await client.file.findFirst({
    where: { id }
  })
}

export const findFilesByPatientId = async (patientId, client = prismaConfig.prisma) => {
  return await client.file.findMany({
    where: {
      patientId,
      status:    'CONFIRMED',
      deletedAt: null
    },
    orderBy: { createdAt: 'desc' }
  })
}

export const updateFileById = async (id, data, client = prismaConfig.prisma) => {
  return await client.file.update({
    where: { id },
    data
  })
}

// File delete services
export const softDeleteFile = async (id, client = prismaConfig.prisma) => {
  return await client.file.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

export const hardDeleteFile = async (id, client = prismaConfig.prisma) => {
  return await client.file.delete({
    where: { id }
  })
}
