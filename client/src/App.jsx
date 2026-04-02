import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
 
// Activation
import SetPassword from './pages/auth/SetPassword'
import Verify2FA from './pages/auth/Verify2FA'
import Setup2FA from './pages/auth/Setup2FA'
 
// Auth
import Login from './pages/auth/Login'
import VerifyMfaLogin from './pages/auth/VerifyMfaLogin'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
 
// Profile
import Profile from './pages/profile/Profile'
import VerifyEmailChange from './pages/profile/VerifyEmailChange'
 
// Admin
import AdminUsers from './pages/admin/AdminUsers'
import AdminUserDetail from './pages/admin/AdminUserDetail'
 
// Guards
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
 
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Account Activation — public */}
        <Route path="/activate" element={<SetPassword />} />
        <Route path="/activate/2fa" element={<Setup2FA />} />
        <Route path="/activate/2fa/verify" element={<Verify2FA />} />
 
        {/* Auth — public */}
        <Route path="/login" element={<Login />} />
        <Route path="/login/mfa" element={<VerifyMfaLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
 
        {/* Profile — requires login */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/email/verify" element={<ProtectedRoute><VerifyEmailChange /></ProtectedRoute>} />
 
        {/* Admin — requires ADMIN role */}
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/users/:id" element={<AdminRoute><AdminUserDetail /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
 
export default App