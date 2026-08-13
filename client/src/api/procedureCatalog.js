import axiosInstance from './axiosInstance'

export const getAllProcedures = async ({ take = 20, skip = 0, search, active } = {}) => {
  const { data } = await axiosInstance.get('/procedures', {
    params: { take, skip, ...(search && { search }), ...(active !== undefined && { active }) }
  })
  return data // { procedures, total, take, skip }
}

export const getProcedure = async (id) => {
  const { data } = await axiosInstance.get(`/procedures/${id}`)
  return data // { procedure }
}

export const createProcedure = async (procedureData) => {
  const { data } = await axiosInstance.post('/procedures', procedureData)
  return data // { procedure }
}

export const updateProcedure = async (id, procedureData) => {
  const { data } = await axiosInstance.patch(`/procedures/${id}`, procedureData)
  return data // { procedure }
}

export const deactivateProcedure = async (id) => {
  const { data } = await axiosInstance.patch(`/procedures/${id}/deactivate`)
  return data // { procedure }
}

export const reactivateProcedure = async (id) => {
  const { data } = await axiosInstance.patch(`/procedures/${id}/reactivate`)
  return data // { procedure }
}