import axiosInstance from './axiosInstance'

// ─── Patients ─────────────────────────────────────────────────────────────────

export const getAllPatients = async ({ take = 20, skip = 0, search, from, to } = {}) => {
  const { data } = await axiosInstance.get('/patients', {
    params: {
      take,
      skip,
      ...(search && { search }),
      ...(from && { from }),
      ...(to && { to }),
    }
  })
  return data
}

export const getPatient = async (id) => {
  const { data } = await axiosInstance.get(`/patients/${id}`)
  return data // { patient }
}

export const createPatient = async (patientData) => {
  const { data } = await axiosInstance.post('/patients', patientData)
  return data // { patient }
}

export const updatePatient = async (id, patientData) => {
  const { data } = await axiosInstance.patch(`/patients/${id}`, patientData)
  return data // { patient }
}

export const deletePatient = async (id) => {
  const { data } = await axiosInstance.delete(`/patients/${id}`)
  return data // { message }
}

// ─── Appointments ──────────────────────────────────────────────────────────────

export const getAllAppointments = async ({ take = 20, skip = 0, search, from, to } = {}) => {
  const { data } = await axiosInstance.get('/appointments', {
    params: {
      take,
      skip,
      ...(search && { search }),
      ...(from && { from }),
      ...(to && { to }),
    }
  })
  return data
}

export const getMyAppointments = async () => {
  const { data } = await axiosInstance.get('/appointments/me')
  return data // { appointments }
}

export const getAppointment = async (id) => {
  const { data } = await axiosInstance.get(`/appointments/${id}`)
  return data // { appointment }
}

export const getAppointmentsByPatient = async (patientId) => {
  const { data } = await axiosInstance.get(`/appointments/patient/${patientId}`)
  return data // { appointments }
}

export const createAppointment = async (appointmentData) => {
  const { data } = await axiosInstance.post('/appointments', appointmentData)
  return data // { appointment }
}

export const updateAppointment = async (id, appointmentData) => {
  const { data } = await axiosInstance.patch(`/appointments/${id}`, appointmentData)
  return data // { appointment }
}

export const deleteAppointment = async (id) => {
  const { data } = await axiosInstance.delete(`/appointments/${id}`)
  return data // { message }
}

// ─── Treatments ────────────────────────────────────────────────────────────────

export const getTreatmentsByVisit = async (visitId) => {
  const { data } = await axiosInstance.get(`/treatments/visit/${visitId}`)
  return data // { treatments }
}

export const getUnbilledTreatments = async (patientId) => {
  const { data } = await axiosInstance.get(`/treatments/patient/${patientId}/unbilled`)
  return data // { treatments }
}

export const getAllTreatmentsByPatient = async (patientId) => {
  const { data } = await axiosInstance.get(`/treatments/patient/${patientId}/all`)
  return data // { treatments }
}

export const createTreatment = async (treatmentData) => {
  const { data } = await axiosInstance.post('/treatments', treatmentData)
  return data // { treatment }
}

export const updateTreatment = async (id, treatmentData) => {
  const { data } = await axiosInstance.patch(`/treatments/${id}`, treatmentData)
  return data // { treatment }
}

export const deleteTreatment = async (id) => {
  const { data } = await axiosInstance.delete(`/treatments/${id}`)
  return data // { message }
}