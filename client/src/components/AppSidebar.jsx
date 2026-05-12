import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { logout } from '../api/auth'

export default function AppSidebar({ active }) {
  const { logoutUser, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    logoutUser()
    navigate('/login')
  }

  return (
    <aside className="home-sidebar">
      <div className="home-logo">ERP</div>
      <nav className="home-nav">
        <span className="home-nav-label">Main</span>
        <Link
          to="/home"
          className={`home-nav-link ${active === 'home' ? 'active' : ''}`}
        >
          Home
        </Link>
        <Link
          to="/profile"
          className={`home-nav-link ${active === 'profile' ? 'active' : ''}`}
        >
          Profile
        </Link>

        <span className="home-nav-label">Clinic</span>
        <Link
          to="/clinic/patients"
          className={`home-nav-link ${active === 'patients' ? 'active' : ''}`}
        >
          Patients
        </Link>
        <Link
          to="/clinic/appointments"
          className={`home-nav-link ${active === 'appointments' ? 'active' : ''}`}
        >
          Appointments
        </Link>

        {isAdmin() && (
          <>
            <span className="home-nav-label">Admin</span>
            <Link
              to="/admin/users"
              className={`home-nav-link ${active === 'admin' ? 'active' : ''}`}
            >
              User management
            </Link>
          </>
        )}

        <span className="home-nav-label">Session</span>
        <button className="home-nav-link danger" onClick={handleLogout}>
          Sign out
        </button>
      </nav>
    </aside>
  )
}