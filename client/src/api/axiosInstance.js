import axios from 'axios'

let isRedirecting = false

const axiosInstance = axios.create({
  baseURL: '/api/v2',
  withCredentials: true,
})

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // express-validator failures arrive as { message: 'Validation failed', errors: [{field, message}] }.
    // Every call site reads error.response.data.message, so fold the field-level
    // detail into that message here, once, instead of at every catch block.
    const fieldErrors = error.response?.data?.errors
    if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
      error.response.data.message = fieldErrors.map(e => e.message).join(' ')
    }

    if (error.response?.status === 401) {
      const publicPaths = ['/login', '/activate', '/forgot-password', '/reset-password']
      const isPublicPage = publicPaths.some(path =>
        window.location.pathname.startsWith(path)
      )

      if (!isPublicPage && !isRedirecting) {
        // Don't retry if this is already a retry
        if (error.config._retry) {
          isRedirecting = true
          window.location.href = '/login'
          setTimeout(() => { isRedirecting = false }, 2000)
          return Promise.reject(error)
        }

        // Retry once — gives remember me token rotation time to complete
        error.config._retry = true
        try {
          return await axiosInstance.request(error.config)
        } catch {
          isRedirecting = true
          window.location.href = '/login'
          setTimeout(() => { isRedirecting = false }, 2000)
        }
      }
    }
    return Promise.reject(error)
  }
)

export default axiosInstance