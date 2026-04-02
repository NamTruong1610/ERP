import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  getUser,
  suspendUser,
  reactivateUser,
  forceLogoutUser,
  resendActivationEmail,
  reset2fa,
  assignRole,
  removeRole,
  deleteUser,
  updateUser
} from '../../api/admin'
import './admin.css'

const STATUS_BADGE = {
  ACTIVE: 'badge-active',
  SUSPENDED: 'badge-suspended',
  PENDING_ACTIVATION: 'badge-pending',
  PENDING_MFA_SETUP: 'badge-pending',
  PENDING_MFA_VERIFICATION: 'badge-pending',
}

const AVAILABLE_ROLES = ['STAFF', 'ADMIN']

export default function AdminUserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  const [editForm, setEditForm] = useState({})
  const [showEdit, setShowEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const fetchUser = async () => {
    try {
      const data = await getUser(id)
      setUser(data)
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) navigate('/login')
      else setError('Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => { await fetchUser() }
    load()
  }, [id])

  const runAction = async (label, fn) => {
    setActionLoading(label)
    setError('')
    setFeedback('')
    try {
      const result = await fn()
      setFeedback(result.message || `${label} successful`)
      await fetchUser()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setActionLoading('')
    }
  }

  const handleAssignRole = async (role) => {
    await runAction('Assign role', () => assignRole(id, role))
  }

  const handleRemoveRole = async (role) => {
    await runAction('Remove role', () => removeRole(id, role))
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) return
    try {
      await deleteUser(id)
      navigate('/admin/users')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      const updated = await updateUser(id, editForm)
      setUser(updated)
      setShowEdit(false)
      setFeedback('User updated successfully')
    } catch (err) {
      setEditError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEditLoading(false)
    }
  }

  const startEdit = () => {
    setEditForm({
      name: user.name || {},
      email: user.email,
      phones: user.phones || [],
      status: user.status
    })
    setShowEdit(true)
  }

  const formatName = (name) => {
    if (!name) return '—'
    return [name.fName, name.mName, name.lName].filter(Boolean).join(' ') || '—'
  }

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—'

  if (loading) return <div className="admin-loading">Loading user...</div>
  if (!user) return <div className="admin-loading">{error || 'User not found'}</div>

  const availableToAssign = AVAILABLE_ROLES.filter(r => !user.roles?.includes(r))

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          ERP
          <div className="sidebar-role">Admin</div>
        </div>
        <nav className="sidebar-nav">
          <Link to="/admin/users" className="sidebar-link">Users</Link>
        </nav>
      </aside>

      <main className="admin-main">
        <Link to="/admin/users" className="back-link">← Back to users</Link>

        <div className="page-header">
          <div>
            <div className="page-title">{formatName(user.name)}</div>
            <div className="page-subtitle">{user.email}</div>
          </div>
          <span className={`badge ${STATUS_BADGE[user.status] || 'badge-pending'}`}>
            {user.status}
          </span>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {/* ── Details ── */}
        <div className="detail-grid">
          <div className="detail-card">
            <div className="detail-label">Email</div>
            <div className="detail-value">{user.email}</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Status</div>
            <div className="detail-value">{user.status}</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">2FA</div>
            <div className="detail-value">{user.mfaEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Created</div>
            <div className="detail-value">{formatDate(user.createdAt)}</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Last updated</div>
            <div className="detail-value">{formatDate(user.updatedAt)}</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Phones</div>
            <div className="detail-value">
              {user.phones?.length ? user.phones.join(', ') : '—'}
            </div>
          </div>
        </div>

        {/* ── Addresses ── */}
        {user.addresses?.length > 0 && (
          <div className="detail-card" style={{ marginBottom: '16px' }}>
            <div className="detail-label" style={{ marginBottom: '12px' }}>Addresses</div>
            {user.addresses.map((a, i) => (
              <div key={i} style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--text)' }}>
                {[a.street, a.suburb, a.post, a.city].filter(Boolean).join(', ')}
              </div>
            ))}
          </div>
        )}

        {/* ── Edit ── */}
        {showEdit ? (
          <div className="actions-panel" style={{ marginBottom: '16px' }}>
            <div className="actions-panel-title">Edit user</div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="detail-grid">
                <div className="form-group">
                  <label>First name</label>
                  <input
                    value={editForm.name?.fName || ''}
                    onChange={e => setEditForm(p => ({ ...p, name: { ...p.name, fName: e.target.value } }))}
                    placeholder="First name"
                  />
                </div>
                <div className="form-group">
                  <label>Last name</label>
                  <input
                    value={editForm.name?.lName || ''}
                    onChange={e => setEditForm(p => ({ ...p, name: { ...p.name, lName: e.target.value } }))}
                    placeholder="Last name"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="Email"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editForm.status || ''}
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="PENDING_ACTIVATION">PENDING_ACTIVATION</option>
                    <option value="PENDING_MFA_SETUP">PENDING_MFA_SETUP</option>
                    <option value="PENDING_MFA_VERIFICATION">PENDING_MFA_VERIFICATION</option>
                  </select>
                </div>
              </div>
              {editError && <div className="feedback-error">{editError}</div>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <button className="btn btn-ghost" onClick={startEdit}>Edit user</button>
          </div>
        )}

        {/* ── Roles ── */}
        <div className="actions-panel">
          <div className="actions-panel-title">Roles</div>
          <div className="roles-list">
            {user.roles?.length ? user.roles.map(role => (
              <span key={role} className="role-tag">
                {role}
                <button onClick={() => handleRemoveRole(role)} title="Remove role">×</button>
              </span>
            )) : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No roles assigned</span>}
          </div>
          {availableToAssign.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {availableToAssign.map(role => (
                <button
                  key={role}
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleAssignRole(role)}
                  disabled={!!actionLoading}
                >
                  + {role}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="actions-panel">
          <div className="actions-panel-title">Actions</div>
          <div className="actions-grid">
            {user.status === 'ACTIVE' && (
              <button
                className="btn btn-ghost"
                disabled={!!actionLoading}
                onClick={() => runAction('Suspend', () => suspendUser(id))}
              >
                {actionLoading === 'Suspend' ? 'Suspending...' : 'Suspend user'}
              </button>
            )}

            {user.status === 'SUSPENDED' && (
              <button
                className="btn btn-ghost"
                disabled={!!actionLoading}
                onClick={() => runAction('Reactivate', () => reactivateUser(id))}
              >
                {actionLoading === 'Reactivate' ? 'Reactivating...' : 'Reactivate user'}
              </button>
            )}

            {user.status === 'PENDING_ACTIVATION' && (
              <button
                className="btn btn-ghost"
                disabled={!!actionLoading}
                onClick={() => runAction('Resend activation', () => resendActivationEmail(id))}
              >
                {actionLoading === 'Resend activation' ? 'Sending...' : 'Resend activation email'}
              </button>
            )}

            {user.mfaEnabled && (
              <button
                className="btn btn-ghost"
                disabled={!!actionLoading}
                onClick={() => runAction('Reset 2FA', () => reset2fa(id))}
              >
                {actionLoading === 'Reset 2FA' ? 'Resetting...' : 'Reset 2FA'}
              </button>
            )}

            <button
              className="btn btn-ghost"
              disabled={!!actionLoading}
              onClick={() => runAction('Force logout', () => forceLogoutUser(id))}
            >
              {actionLoading === 'Force logout' ? 'Logging out...' : 'Force logout'}
            </button>

            <button
              className="btn btn-danger"
              disabled={!!actionLoading}
              onClick={handleDelete}
            >
              Delete user
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}