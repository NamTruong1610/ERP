import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: '/api/v2',
  withCredentials: true,
})

// Re-direct unauthenticated requests to login page
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const publicPaths = ['/login', '/activate', '/forgot-password', '/reset-password']
      const isPublicPage = publicPaths.some(path =>
        window.location.pathname.startsWith(path)
      )
      if (!isPublicPage) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default axiosInstance