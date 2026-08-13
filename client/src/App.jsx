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

import Home from './pages/home/Home'

// Profile
import Profile from './pages/profile/Profile'
import VerifyEmailChange from './pages/profile/VerifyEmailChange'

// Admin
import AdminUsers from './pages/admin/AdminUsers'
import AdminUserDetail from './pages/admin/AdminUserDetail'

import Patients from './pages/clinic/Patients'
import PatientDetail from './pages/clinic/PatientDetail'
import Appointments from './pages/clinic/Appointments'
import AppointmentDetail from './pages/clinic/AppointmentDetail'

import TreatmentPlans from './pages/clinic/TreatmentPlans'
import TreatmentPlanDetail from './pages/clinic/TreatmentPlanDetail'

import Procedures from './pages/admin/Procedures'

import VisitDetail from './pages/clinic/VisitDetail'

import Invoices from './pages/clinic/Invoices'
import InvoiceDetail from './pages/clinic/InvoiceDetail'

// System — super admin
import AuditLog from './pages/system/AuditLog'
import Sessions from './pages/system/Sessions'
import DeletedUsers from './pages/system/DeletedUsers'

// Guards
import { ProtectedRoute, AdminRoute, SuperAdminRoute } from './routes/guards'


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Account Activation — public */}
        <Route path="/activate" element={<SetPassword />} />
        <Route path="/activate/2fa" element={<Setup2FA />} />
        <Route path="/activate/2fa/verify" element={<Verify2FA />} />

        {/* Auth — public */}
        <Route path="/login" element={<Login />} />
        <Route path="/login/mfa" element={<VerifyMfaLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />

        {/* Profile — requires login */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/email/verify" element={<ProtectedRoute><VerifyEmailChange /></ProtectedRoute>} />

        {/* Admin — requires ADMIN role */}
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/users/:id" element={<AdminRoute><AdminUserDetail /></AdminRoute>} />
        <Route path="/admin/procedures" element={<ProtectedRoute><Procedures /></ProtectedRoute>} />

        <Route path="/clinic/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
        <Route path="/clinic/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
        <Route path="/clinic/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
        <Route path="/clinic/appointments/:id" element={<ProtectedRoute><AppointmentDetail /></ProtectedRoute>} />
        <Route path="/clinic/treatment-plans" element={<ProtectedRoute><TreatmentPlans /></ProtectedRoute>} />
        <Route path="/clinic/treatment-plans/:id" element={<ProtectedRoute><TreatmentPlanDetail /></ProtectedRoute>} />
        <Route path="/clinic/visits/:id" element={<ProtectedRoute><VisitDetail /></ProtectedRoute>} />
        <Route path="/clinic/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
        <Route path="/clinic/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />

        <Route
          path="/system/audit"
          element={
            <SuperAdminRoute>
              <AuditLog />
            </SuperAdminRoute>
          }
        />
        <Route
          path="/system/sessions"
          element={
            <SuperAdminRoute>
              <Sessions />
            </SuperAdminRoute>
          }
        />
        <Route
          path="/system/users/deleted"
          element={
            <SuperAdminRoute>
              <DeletedUsers />
            </SuperAdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App