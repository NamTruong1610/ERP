import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { logout } from '../../api/auth'
import './home.css'

export default function Home() {
  const { user, logoutUser, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    logoutUser()
    navigate('/login')
  }

  const firstName = user?.name?.fName || user?.email?.split('@')[0] || 'there'

  return (
    <div className="home-layout">
      <aside className="home-sidebar">
        <div className="home-logo">ERP</div>
        <nav className="home-nav">
          <span className="home-nav-label">Main</span>
          <Link to="/home" className="home-nav-link active">Home</Link>
          <Link to="/profile" className="home-nav-link">Profile</Link>
          {isAdmin() && (
            <>
              <span className="home-nav-label">Admin</span>
              <Link to="/admin/users" className="home-nav-link">User management</Link>
            </>
          )}
          <span className="home-nav-label">Session</span>
          <button className="home-nav-link danger" onClick={handleLogout}>Sign out</button>
        </nav>
      </aside>

      <main className="home-main">
        <div className="home-header">
          <div className="home-greeting">
            <span className="home-greeting-sub">Welcome back</span>
            <h1 className="home-greeting-name">Hi, {firstName}</h1>
          </div>
          <div className="home-badge">{user?.roles?.join(', ')}</div>
        </div>

        <div className="home-empty">
          <div className="home-empty-icon">⬡</div>
          <div className="home-empty-title">Nothing here yet</div>
          <div className="home-empty-sub">This is your home page. Content will appear here as the system grows.</div>
        </div>
      </main>
    </div>
  )
}