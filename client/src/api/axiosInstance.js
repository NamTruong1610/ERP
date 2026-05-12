import axios from 'axios'

let isRedirecting = false  // ← flag to prevent double redirect

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
      if (!isPublicPage && !isRedirecting) {
        window.location.href = '/login'
        // Reset flag after redirect completes
        setTimeout(() => { isRedirecting = false }, 2000)
      }
    }
    return Promise.reject(error)
  }
)

export default axiosInstance