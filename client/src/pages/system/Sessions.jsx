import { useState, useEffect } from 'react'
import AppSidebar from '../../components/layout/AppSidebar'
import { getAllSessions, revokeSession, revokeAllSessions } from '../../api/system'
import { useAuth } from '../../context/useAuth'
import { timeAgo } from '../../lib/format'
import '../../styles/global.css'

export default function Sessions() {
  const { user: currentUser } = useAuth()
  const [sessions,  setSessions]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [revoking,  setRevoking]  = useState(null)
  const [confirm,   setConfirm]   = useState(false)

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const data = await getAllSessions()
      setSessions(data.sessions)
    } catch {
      setError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSessions() }, [])

  const handleRevoke = async (sessionId) => {
    setRevoking(sessionId)
    try {
      await revokeSession(sessionId)
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch {
      setError('Failed to revoke session')
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAll = async () => {
    setConfirm(false)
    setRevoking('all')
    try {
      await revokeAllSessions()
      setSessions([])
    } catch {
      setError('Failed to revoke all sessions')
    } finally {
      setRevoking(null)
    }
  }

  const formatName = (session) => {
    const name = session.user?.name
    if (name?.fName || name?.lName) {
      return [name.fName, name.lName].filter(Boolean).join(' ')
    }
    return session.user?.email ?? 'Unknown'
  }

  return (
    <div className="app-layout">
      <AppSidebar active="system-sessions" />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">Active sessions</div>
            <div className="page-subtitle">{sessions.length} active</div>
          </div>
          <div className="page-actions">
            <button className="btn" onClick={fetchSessions}>
              <i className="ti ti-refresh" aria-hidden="true" /> Refresh
            </button>
            {sessions.length > 0 && (
              <button
                className="btn btn-danger"
                onClick={() => setConfirm(true)}
                disabled={revoking === 'all'}
              >
                <i className="ti ti-logout" aria-hidden="true" />
                Revoke all
              </button>
            )}
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* Revoke all confirmation */}
        {confirm && (
          <div className="card" style={{
            marginBottom: '16px', padding: '16px',
            border: '1px solid var(--danger-border)'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Revoke all sessions?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              This will immediately log out all users including yourself.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-danger btn-sm" onClick={handleRevokeAll}>
                Yes, revoke all
              </button>
              <button className="btn btn-sm" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-device-desktop" aria-hidden="true" />
              <div className="empty-title">No active sessions</div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>IP address</th>
                  <th>Started</th>
                  <th>Session ID</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => {
                  const isCurrent = session.userId === currentUser?.id
                  return (
                    <tr key={session.sessionId}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>
                          {formatName(session)}
                          {isCurrent && (
                            <span style={{
                              fontSize: '11px', color: 'var(--primary)',
                              marginLeft: '6px', fontWeight: 400
                            }}>
                              (you)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {session.user?.email}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {session.ip ?? '—'}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {session.createdAt ? timeAgo(session.createdAt) : '—'}
                      </td>
                      <td style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-hint)' }}>
                        {session.sessionId?.slice(0, 12)}…
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRevoke(session.sessionId)}
                          disabled={revoking === session.sessionId}
                        >
                          {revoking === session.sessionId ? 'Revoking…' : 'Revoke'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}