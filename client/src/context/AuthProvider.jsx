import { useState, useEffect } from 'react'
import { AuthContext } from './AuthContext'
import { getProfile } from '../api/user'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await getProfile()
        setUser(data)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  const login = (userData) => setUser(userData)
  const logoutUser = () => setUser(null)
  const isAdmin = () => user?.roles?.includes('ADMIN') ?? false

  return (
    <AuthContext.Provider value={{ user, loading, login, logoutUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}