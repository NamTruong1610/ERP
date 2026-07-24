import { useState, useEffect } from 'react'
import AppSidebar from '../../components/layout/AppSidebar'
import { getDeletedUsers, restoreUser, purgeUser } from '../../api/system'
import { formatDateLong } from '../../lib/format'
import '../../styles/global.css'


export default function DeletedUsers() {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [actioning, setActioning] = useState(null)
  const [confirmPurge, setConfirmPurge] = useState(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await getDeletedUsers()
      setUsers(data.users)
    } catch {
      setError('Failed to load deleted users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleRestore = async (id) => {
    setActioning(id + '-restore')
    try {
      await restoreUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore user')
    } finally {
      setActioning(null)
    }
  }

  const handlePurge = async (id) => {
    setConfirmPurge(null)
    setActioning(id + '-purge')
    try {
      await purgeUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to purge user')
    } finally {
      setActioning(null)
    }
  }

  const formatName = (user) => {
    const n = user.name
    if (n?.fName || n?.lName) return [n.fName, n.lName].filter(Boolean).join(' ')
    return '—'
  }

  const initials = (user) => {
    const n = user.name
    if (n?.fName && n?.lName) return `${n.fName[0]}${n.lName[0]}`.toUpperCase()
    return user.email[0].toUpperCase()
  }

  return (
    <div className="app-layout">
      <AppSidebar active="system-deleted" />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">Deleted users</div>
            <div className="page-subtitle">{users.length} deleted accounts</div>
          </div>
          <button className="btn" onClick={fetchUsers}>
            <i className="ti ti-refresh" aria-hidden="true" /> Refresh
          </button>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* Purge confirmation */}
        {confirmPurge && (
          <div className="card" style={{
            marginBottom: '16px', padding: '16px',
            border: '1px solid var(--danger-border)'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Permanently delete this account?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {users.find(u => u.id === confirmPurge)?.email} — This cannot be undone. All data is permanently removed.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handlePurge(confirmPurge)}
              >
                Delete permanently
              </button>
              <button className="btn btn-sm" onClick={() => setConfirmPurge(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading deleted users...</div>
        ) : users.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-user-x" aria-hidden="true" />
              <div className="empty-title">No deleted users</div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th>Deleted</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar" style={{ opacity: 0.5 }}>
                          {initials(user)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {formatName(user)}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-hint)' }}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {user.roles?.map(r => (
                          <span key={r.id} className={`badge badge-${r.role.toLowerCase()}`}>
                            {r.role.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {user.deletedAt ? formatDateLong(user.deletedAt) : '—'}
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatDateLong(user.createdAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleRestore(user.id)}
                          disabled={actioning === user.id + '-restore'}
                        >
                          {actioning === user.id + '-restore' ? 'Restoring…' : 'Restore'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setConfirmPurge(user.id)}
                          disabled={!!actioning}
                        >
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}