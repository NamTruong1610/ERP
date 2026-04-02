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
      const isLoginPage = window.location.pathname === '/login'
      if (!isLoginPage) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default axiosInstance