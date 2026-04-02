import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
 
// Shows a blank screen while the session check is in progress
// Prevents a flash redirect to /login before we know if the user is logged in
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0f1117',
    color: '#6b7280',
    fontFamily: 'Sora, sans-serif',
    fontSize: '14px'
  }}>
    Loading...
  </div>
)
 
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