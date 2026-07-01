// pages/home/Home.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/AppSidebar'
import axiosInstance from '../../api/axiosInstance'

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, loading }) => (
  <div className="card" style={{ padding: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <div style={{
        width: '36px', height: '36px',
        borderRadius: '8px',
        background: 'var(--primary-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--primary)', flexShrink: 0
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: '18px' }} />
      </div>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </span>
    </div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
      {loading ? '—' : value ?? '0'}
    </div>
  </div>
)

// ─── Recent Activity ──────────────────────────────────────────────────────────

const actionLabel = (action) => {
  const map = {
    LOGIN_SUCCESS:          'Logged in',
    LOGOUT:                 'Logged out',
    PATIENT_CREATED:        'Created a patient',
    PATIENT_UPDATED:        'Updated a patient',
    PATIENT_DELETED:        'Deleted a patient',
    APPOINTMENT_CREATED:    'Created an appointment',
    APPOINTMENT_UPDATED:    'Updated an appointment',
    APPOINTMENT_CANCELLED:  'Cancelled an appointment',
    APPOINTMENT_DELETED:    'Deleted an appointment',
    TREATMENT_CREATED:      'Recorded a treatment',
    TREATMENT_UPDATED:      'Updated a treatment',
    FILE_UPLOADED:          'Uploaded a file',
    PASSWORD_CHANGED:       'Changed password',
    EMAIL_CHANGED:          'Changed email',
    MFA_ENABLED:            'Enabled 2FA',
    MFA_DISABLED:           'Disabled 2FA',
  }
  return map[action] ?? action.toLowerCase().replace(/_/g, ' ')
}

const timeAgo = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)

  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const formatDate = () =>
  new Date().toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, isAdmin, isSuperAdmin } = useAuth()

  const [myStats,     setMyStats]     = useState(null)
  const [clinicStats, setClinicStats] = useState(null)
  const [systemStats, setSystemStats] = useState(null)
  const [loading,     setLoading]     = useState(true)

  const firstName = user?.name?.fName ?? user?.email?.split('@')[0] ?? 'there'

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // All users get personal stats
        const promises = [axiosInstance.get('/stats/me')]

        // Admins additionally get clinic stats
        if (isAdmin()) promises.push(axiosInstance.get('/stats/clinic'))

        // Super admins additionally get system stats
        if (isSuperAdmin()) promises.push(axiosInstance.get('/stats/system'))

        const results = await Promise.allSettled(promises)

        if (results[0].status === 'fulfilled') setMyStats(results[0].value.data)
        if (results[1]?.status === 'fulfilled') setClinicStats(results[1].value.data)
        if (results[2]?.status === 'fulfilled') setSystemStats(results[2].value.data)
      } catch {
        // silently fail — stats are non-critical
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <AppSidebar active="home" />

      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>

        {/* Greeting */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {getGreeting()}, {firstName}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {formatDate()}
          </div>
        </div>

        {/* Personal stats — all users */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
            My activity
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            <StatCard
              icon="ti-calendar-event"
              label="Appointments today"
              value={myStats?.appointmentsToday}
              loading={loading}
            />
            <StatCard
              icon="ti-calendar-week"
              label="This week"
              value={myStats?.appointmentsThisWeek}
              loading={loading}
            />
            <StatCard
              icon="ti-users"
              label="My patients"
              value={myStats?.uniquePatients}
              loading={loading}
            />
          </div>
        </section>

        {/* Clinic stats — admin+ */}
        {isAdmin() && (
          <section style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
              Clinic overview
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              <StatCard
                icon="ti-user-heart"
                label="Total patients"
                value={clinicStats?.totalPatients}
                loading={loading}
              />
              <StatCard
                icon="ti-calendar-event"
                label="Appointments today"
                value={clinicStats?.appointmentsToday}
                loading={loading}
              />
              <StatCard
                icon="ti-calendar-week"
                label="This week"
                value={clinicStats?.appointmentsThisWeek}
                loading={loading}
              />
              <StatCard
                icon="ti-users"
                label="Active staff"
                value={clinicStats?.totalActiveUsers}
                loading={loading}
              />
              {clinicStats?.pendingActivations > 0 && (
                <StatCard
                  icon="ti-user-exclamation"
                  label="Pending activation"
                  value={clinicStats?.pendingActivations}
                  loading={loading}
                />
              )}
            </div>

            {/* Appointment breakdown */}
            {clinicStats?.appointmentsByStatus && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(clinicStats.appointmentsByStatus).map(([status, count]) => (
                  <div key={status} style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{count}</span>
                    {' '}{status.toLowerCase()}
                  </div>
                ))}
              </div>
            )}

            {/* Recent patients */}
            {clinicStats?.recentPatients?.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                  Recently registered
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {clinicStats.recentPatients.map((p, i) => (
                    <div key={p.id} style={{
                      padding: '12px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: i < clinicStats.recentPatients.length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {p.firstName} {p.lastName}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-hint)' }}>
                        {timeAgo(p.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* System stats — super admin */}
        {isSuperAdmin() && (
          <section style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
              System
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              <StatCard
                icon="ti-device-desktop"
                label="Active sessions"
                value={systemStats?.activeSessions}
                loading={loading}
              />
              <StatCard
                icon="ti-shield-x"
                label="Failed logins today"
                value={systemStats?.failedLoginsToday}
                loading={loading}
              />
              <StatCard
                icon="ti-file"
                label="Total files"
                value={systemStats?.totalFiles}
                loading={loading}
              />
              <StatCard
                icon="ti-database"
                label="Storage used"
                value={systemStats ? `${systemStats.totalStorageMB} MB` : null}
                loading={loading}
              />
              <StatCard
                icon="ti-list-details"
                label="Audit logs today"
                value={systemStats?.auditLogsToday}
                loading={loading}
              />
            </div>
          </section>
        )}

        {/* Recent activity — all users */}
        {myStats?.recentActivity?.length > 0 && (
          <section>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
              Recent activity
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {myStats.recentActivity.map((entry, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: i < myStats.recentActivity.length - 1 ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="ti ti-activity" style={{ fontSize: '14px', color: 'var(--text-hint)' }} />
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {actionLabel(entry.action)}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-hint)' }}>
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cached at */}
        {myStats?.cachedAt && (
          <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-hint)', textAlign: 'right' }}>
            Last updated {timeAgo(myStats.cachedAt)}
          </div>
        )}

      </main>
    </div>
  )
}