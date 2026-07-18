import { useState, useEffect } from 'react'
import { AuthContext } from './AuthContext'
import { getMe } from '../api/auth'

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
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

  const login     = (userData) => setUser(userData)
  const logoutUser = () => setUser(null)

  // Merge a partial patch into the current user (e.g. after a profile edit
  // whose response already contains the new value) — no network call.
  const updateUser = (patch) => setUser(prev => prev ? { ...prev, ...patch } : prev)

  const isAdmin = () =>
    user?.roles?.some(r => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN') ?? false

  const isSuperAdmin = () =>
    user?.roles?.some(r => r.role === 'SUPER_ADMIN') ?? false

  const refreshUser = async () => {
    try {
      const data = await getMe()
      setUser(data)
    } catch {
      // silently fail
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logoutUser,
      updateUser,
      isAdmin,
      isSuperAdmin,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}