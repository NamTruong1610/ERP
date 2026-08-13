import axiosInstance from './axiosInstance'

export const getAllTreatmentPlans = async ({ take = 20, skip = 0, patientId, status } = {}) => {
  const { data } = await axiosInstance.get('/treatment-plans', {
    params: { take, skip, ...(patientId && { patientId }), ...(status && { status }) }
  })
  return data // { treatmentPlans, total, take, skip }
}

export const getTreatmentPlan = async (id) => {
  const { data } = await axiosInstance.get(`/treatment-plans/${id}`)
  return data // { treatmentPlan }
}

export const createTreatmentPlan = async (planData) => {
  const { data } = await axiosInstance.post('/treatment-plans', planData)
  return data // { treatmentPlan }
}

export const addTreatmentPlanItemsBulk = async (planId, items) => {
  const { data } = await axiosInstance.post(`/treatment-plans/${planId}/items/bulk`, { items })
  return data // { items }
}

export const createTreatmentPlanItem = async (planId, itemData) => {
  const { data } = await axiosInstance.post(`/treatment-plans/${planId}/items`, itemData)
  return data // { treatmentPlanItem }
}

export const updateTreatmentPlanItem = async (planId, itemId, itemData) => {
  const { data } = await axiosInstance.patch(`/treatment-plans/${planId}/items/${itemId}`, itemData)
  return data // { treatmentPlanItem }
}

export const deleteTreatmentPlanItem = async (planId, itemId) => {
  await axiosInstance.delete(`/treatment-plans/${planId}/items/${itemId}`)
}

export const attachTreatmentsToTreatmentPlan = async (planId, treatmentIds) => {
  const { data } = await axiosInstance.post(`/treatment-plans/${planId}/treatments/attach`, { treatmentIds })
  return data // { treatmentPlan }
}

export const updateTreatmentPlan = async (id, updates) => {
  const { data } = await axiosInstance.patch(`/treatment-plans/${id}`, updates)
  return data // { treatmentPlan }
}