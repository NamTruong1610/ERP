import axios from 'axios'

let isRedirecting = false

const axiosInstance = axios.create({
  baseURL: '/api/v2',
  withCredentials: true,
})

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
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