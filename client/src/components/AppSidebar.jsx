// components/AppSidebar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const NavItem = ({ icon, label, path, active, onClick }) => (
  <button
    onClick={onClick}
    className={`nav-item ${active ? 'nav-item-active' : ''}`}
    style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      width: '100%', padding: '8px 12px', borderRadius: '8px',
      border: 'none', cursor: 'pointer', fontSize: '14px',
      background: active ? 'var(--primary-muted)' : 'transparent',
      color: active ? 'var(--primary)' : 'var(--text-secondary)',
      fontWeight: active ? 600 : 400,
      textAlign: 'left', transition: 'background 0.15s, color 0.15s'
    }}
  >
    <i className={`ti ${icon}`} style={{ fontSize: '18px', flexShrink: 0 }} aria-hidden="true" />
    {label}
  </button>
)

const SectionLabel = ({ label }) => (
  <div style={{
    fontSize: '11px', fontWeight: 600, color: 'var(--text-hint)',
    textTransform: 'uppercase', letterSpacing: '.08em',
    padding: '0 12px', marginBottom: '4px', marginTop: '16px'
  }}>
    {label}
  </div>
)

export default function AppSidebar({ active }) {
  const navigate   = useNavigate()
  const { user, logoutUser, isAdmin, isSuperAdmin } = useAuth()

  const firstName = user?.name?.fName ?? user?.email?.split('@')[0] ?? 'User'
  const lastName  = user?.name?.lName ?? ''
  const initials  = `${firstName[0]}${lastName ? lastName[0] : ''}`.toUpperCase()

  const go = (path) => navigate(path)

  const handleLogout = async () => {
    try {
      await fetch('/api/v2/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // silently fail — clear local state regardless
    }
    logoutUser()
    navigate('/login')
  }

  return (
    <aside style={{
      width: '220px', minHeight: '100vh', flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '16px 12px'
    }}>

      {/* Brand */}
      <div
        onClick={() => go('/home')}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '4px 12px', marginBottom: '20px',
          cursor: 'pointer', color: 'var(--primary)'
        }}
      >
        <i className="ti ti-tooth" style={{ fontSize: '22px' }} aria-hidden="true" />
        <span style={{ fontSize: '16px', fontWeight: 700 }}>DentaCore</span>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1 }}>
        <NavItem
          icon="ti-home"
          label="Home"
          active={active === 'home'}
          onClick={() => go('/home')}
        />
        <NavItem
          icon="ti-user-heart"
          label="Patients"
          active={active === 'patients'}
          onClick={() => go('/clinic/patients')}
        />
        <NavItem
          icon="ti-calendar"
          label="Appointments"
          active={active === 'appointments'}
          onClick={() => go('/clinic/appointments')}
        />

        {/* Admin section — admin and super admin */}
        {isAdmin() && (
          <>
            <SectionLabel label="Admin" />
            <NavItem
              icon="ti-users"
              label="User management"
              active={active === 'admin'}
              onClick={() => go('/admin/users')}
            />
          </>
        )}

        {/* System section — super admin only */}
        {isSuperAdmin() && (
          <>
            <SectionLabel label="System" />
            <NavItem
              icon="ti-list-details"
              label="Audit log"
              active={active === 'system-audit'}
              onClick={() => go('/system/audit')}
            />
            <NavItem
              icon="ti-device-desktop"
              label="Sessions"
              active={active === 'system-sessions'}
              onClick={() => go('/system/sessions')}
            />
            <NavItem
              icon="ti-user-x"
              label="Deleted users"
              active={active === 'system-deleted'}
              onClick={() => go('/system/users/deleted')}
            />
          </>
        )}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '8px' }}>

        {/* Profile link */}
        <button
          onClick={() => go('/profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '8px 12px', borderRadius: '8px',
            border: 'none', cursor: 'pointer', background: 'transparent',
            textAlign: 'left', marginBottom: '4px'
          }}
        >
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'var(--primary-muted)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, flexShrink: 0
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '13px', fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {firstName} {lastName}
            </div>
            <div style={{
              fontSize: '11px', color: 'var(--text-hint)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {user?.roles?.map(r => r.role.toLowerCase()).join(', ')}
            </div>
          </div>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '8px 12px', borderRadius: '8px',
            border: 'none', cursor: 'pointer', background: 'transparent',
            color: 'var(--text-hint)', fontSize: '14px', textAlign: 'left'
          }}
        >
          <i className="ti ti-logout" style={{ fontSize: '18px' }} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  )
}