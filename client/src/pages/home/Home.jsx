import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/AppSidebar'
import '../../styles/global.css'

export default function Home() {
  const { user } = useAuth()

  const firstName = user?.name?.fName || user?.email?.split('@')[0] || 'there'
  const timeOfDay = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="app-layout">
      <AppSidebar active="home" />
      <main className="main">
        <div style={{ marginBottom: '32px' }}>
          <div className="page-title">{timeOfDay()}, {firstName}</div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('en-AU', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              <i className="ti ti-users" aria-hidden="true" />
              Total patients
            </div>
            <div className="stat-value">—</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <i className="ti ti-calendar" aria-hidden="true" />
              Appointments today
            </div>
            <div className="stat-value">—</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <i className="ti ti-check" aria-hidden="true" />
              Completed this month
            </div>
            <div className="stat-value">—</div>
          </div>
        </div>

        <div className="card">
          <div className="empty">
            <i className="ti ti-layout-dashboard" aria-hidden="true" />
            <div className="empty-title">Dashboard coming soon</div>
            <div className="empty-subtitle">
              Stats and quick actions will appear here
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}