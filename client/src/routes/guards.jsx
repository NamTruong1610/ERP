import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import LoadingScreen from '../components/ui/LoadingScreen'
 
// Requires authenticated session
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
 
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
 
  return children
}
 
// Requires authenticated session AND ADMIN role
export const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth()
 
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/profile" replace />
 
  return children
}

export const SuperAdminRoute = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin()) return <Navigate to="/home" replace />

  return children
}