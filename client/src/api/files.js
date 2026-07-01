import axiosInstance from './axiosInstance'

export const getPatientFiles = async (patientId) => {
  const { data } = await axiosInstance.get(`/files/patient/${patientId}`)
  return data  // { files }
}

export const initiateUpload = async (patientId, { fileName, mimeType, sizeBytes }) => {
  const { data } = await axiosInstance.post(`/files/patient/${patientId}/initiate`, {
    fileName, mimeType, sizeBytes
  })
  return data  // { uploadUrl, fileId }
}

export const confirmUpload = async (fileId) => {
  const { data } = await axiosInstance.post(`/files/${fileId}/confirm`)
  return data
}

export const getDownloadUrl = async (fileId) => {
  const { data } = await axiosInstance.get(`/files/${fileId}/download`)
  return data  // { downloadUrl }
}

export const softDeleteFile = async (fileId) => {
  const { data } = await axiosInstance.delete(`/files/${fileId}`)
  return data
}