import { useState, useEffect } from 'react'
import { AuthContext } from './AuthContext'
import { getMe } from '../api/auth'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await getMe()
        setUser(data)
      } catch (err) {
        if (err.response?.status === 401) {
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  const login = (userData) => setUser(userData)
  const logoutUser = () => setUser(null)
  const isAdmin = () => user?.roles?.some(r => r.role === 'ADMIN') ?? false
  const refreshUser = async () => {
    try {
      const data = await getMe()
      setUser(data)
    } catch {
      // silently fail
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logoutUser, isAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}