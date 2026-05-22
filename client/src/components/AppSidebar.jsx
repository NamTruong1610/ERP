import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { logout } from '../api/auth'
import '../styles/global.css'

export default function AppSidebar({ active }) {
  const { user, logoutUser, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    logoutUser()
    navigate('/login')
  }

  const initials = user?.name
    ? `${user.name.fName?.[0] ?? ''}${user.name.lName?.[0] ?? ''}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  const displayName = user?.name
    ? `${user.name.fName} ${user.name.lName}`
    : user?.email ?? ''

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/home" className="sidebar-logo">
          <i className="ti ti-tooth" aria-hidden="true" />
          DentaCore
        </Link>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section">Main</span>
        <Link
          to="/home"
          className={`sidebar-item ${active === 'home' ? 'active' : ''}`}
        >
          <i className="ti ti-home" aria-hidden="true" />
          Home
        </Link>
        <Link
          to="/profile"
          className={`sidebar-item ${active === 'profile' ? 'active' : ''}`}
        >
          <i className="ti ti-user" aria-hidden="true" />
          Profile
        </Link>

        <span className="sidebar-section">Clinic</span>
        <Link
          to="/clinic/patients"
          className={`sidebar-item ${active === 'patients' ? 'active' : ''}`}
        >
          <i className="ti ti-users" aria-hidden="true" />
          Patients
        </Link>
        <Link
          to="/clinic/appointments"
          className={`sidebar-item ${active === 'appointments' ? 'active' : ''}`}
        >
          <i className="ti ti-calendar" aria-hidden="true" />
          Appointments
        </Link>

        {isAdmin() && (
          <>
            <span className="sidebar-section">Admin</span>
            <Link
              to="/admin/users"
              className={`sidebar-item ${active === 'admin' ? 'active' : ''}`}
            >
              <i className="ti ti-settings" aria-hidden="true" />
              User management
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info" style={{ marginBottom: '8px' }}>
          <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
            {initials}
          </div>
          <div>
            <div className="user-info-name" style={{ fontSize: '12px' }}>{displayName}</div>
            <div className="user-info-role">
              {user?.roles?.map(r => r.toLowerCase()).join(', ')}
            </div>
          </div>
        </div>
        <button className="sidebar-item danger" onClick={handleLogout} style={{ width: '100%' }}>
          <i className="ti ti-logout" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  )
}