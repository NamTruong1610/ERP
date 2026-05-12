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
      } catch(err) {
        // Only clear user if it's a genuine auth failure (401)
        // A 500 means server error — don't log the user out
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
  const isAdmin = () => user?.roles?.includes('ADMIN') ?? false

  return (
    <AuthContext.Provider value={{ user, loading, login, logoutUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}