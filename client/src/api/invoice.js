import axiosInstance from './axiosInstance'

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const getAllInvoices = async ({ take = 20, skip = 0, patientId, status } = {}) => {
  const { data } = await axiosInstance.get('/invoices', {
    params: {
      take,
      skip,
      ...(patientId && { patientId }),
      ...(status && { status }),
    }
  })
  return data // { invoices, total, take, skip }
}

export const getInvoice = async (id) => {
  const { data } = await axiosInstance.get(`/invoices/${id}`)
  return data // { invoice }
}

export const createInvoice = async (invoiceData) => {
  const { data } = await axiosInstance.post('/invoices', invoiceData)
  return data // { invoice }
}

export const updateInvoice = async (id, invoiceData) => {
  const { data } = await axiosInstance.patch(`/invoices/${id}`, invoiceData)
  return data // { invoice }
}

export const issueInvoice = async (id) => {
  const { data } = await axiosInstance.post(`/invoices/${id}/issue`)
  return data // { invoice }
}

export const voidInvoice = async (id, reason) => {
  const { data } = await axiosInstance.post(`/invoices/${id}/void`, { reason })
  return data // { invoice }
}

export const deleteInvoice = async (id) => {
  await axiosInstance.delete(`/invoices/${id}`)
}

// ─── Invoice items ────────────────────────────────────────────────────────────

export const createInvoiceItem = async (invoiceId, itemData) => {
  const { data } = await axiosInstance.post(`/invoices/${invoiceId}/items`, itemData)
  return data // { invoice }
}

export const updateInvoiceItem = async (invoiceId, itemId, itemData) => {
  const { data } = await axiosInstance.patch(`/invoices/${invoiceId}/items/${itemId}`, itemData)
  return data // { invoice }
}

export const deleteInvoiceItem = async (invoiceId, itemId) => {
  const { data } = await axiosInstance.delete(`/invoices/${invoiceId}/items/${itemId}`)
  return data // { invoice }
}

// ─── Unbilled treatments (used when drafting a new invoice) ──────────────────

export const getUnbilledTreatments = async (patientId) => {
  const { data } = await axiosInstance.get(`/treatments/patient/${patientId}/unbilled`)
  return data // { treatments }
}