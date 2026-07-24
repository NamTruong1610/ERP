import { useState, useEffect, useReducer } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  getUser, suspendUser, reactivateUser, forceLogoutUser,
  resendActivationEmail, reset2fa, assignRole, removeRole,
  deleteUser, updateUser
} from '../../api/admin'
import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/layout/AppSidebar'
import '../../styles/global.css'

const STATUS_BADGE = {
  ACTIVE: 'badge-active',
  SUSPENDED: 'badge-suspended',
  PENDING_ACTIVATION: 'badge-pending',
  PENDING_MFA_SETUP: 'badge-pending',
  PENDING_MFA_VERIFICATION: 'badge-pending',
}

const AVAILABLE_ROLES = ['STAFF', 'ADMIN']

function editReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'setName': return { ...state, name: { ...state.name, [action.field]: action.value } }
    case 'init': return action.payload
    default: return state
  }
}

export default function AdminUserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, dispatchEdit] = useReducer(editReducer, {})
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const isSelf = currentUser?.id === id

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

  useEffect(() => { fetchUser() }, [id])

  const showFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  const runAction = async (label, fn) => {
    setActionLoading(label)
    setError('')
    try {
      const result = await fn()
      showFeedback(result.message || `${label} successful`)
      await fetchUser()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setActionLoading('')
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
      showFeedback('User updated')
    } catch (err) {
      setEditError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this user? This cannot be undone.')) return
    try {
      await deleteUser(id)
      navigate('/admin/users')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const formatName = (name) => {
    if (!name) return '—'
    return [name.fName, name.mName, name.lName].filter(Boolean).join(' ') || '—'
  }

  const formatDate = (d) => d ? new Date(d).toLocaleString('en-AU') : '—'

  const initials = (u) => {
    if (u?.name?.fName && u?.name?.lName) return `${u.name.fName[0]}${u.name.lName[0]}`.toUpperCase()
    return u?.email?.[0]?.toUpperCase() ?? '?'
  }

  const availableToAssign = AVAILABLE_ROLES.filter(r => 
    !user?.roles?.some(ur => ur.role === r)
  )

  if (loading) return <div className="loading">Loading user...</div>
  if (!user) return <div className="loading">{error || 'User not found'}</div>

  return (
    <div className="app-layout">
      <AppSidebar active="admin" />
      <main className="main" style={{ maxWidth: '720px' }}>
        <Link to="/admin/users" className="back-link">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to users
        </Link>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="avatar" style={{ width: '44px', height: '44px', fontSize: '16px' }}>
              {initials(user)}
            </div>
            <div>
              <div className="page-title">{formatName(user.name)}</div>
              <div className="page-subtitle">{user.email}</div>
            </div>
          </div>
          <span className={`badge ${STATUS_BADGE[user.status] || 'badge-pending'}`}>
            {user.status.toLowerCase().replace(/_/g, ' ')}
          </span>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {/* Details */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-title">Details</div>
          <div className="detail-grid" style={{ marginBottom: 0 }}>
            <div className="detail-item">
              <div className="detail-label">Email</div>
              <div className="detail-value">{user.email}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Status</div>
              <div className="detail-value">{user.status.toLowerCase().replace(/_/g, ' ')}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">2FA</div>
              <div className="detail-value">{user.userMfa?.enabled ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Phones</div>
              <div className="detail-value">{user.phones?.length ? user.phones.join(', ') : '—'}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Created</div>
              <div className="detail-value">{formatDate(user.createdAt)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Last updated</div>
              <div className="detail-value">{formatDate(user.updatedAt)}</div>
            </div>
          </div>
        </div>

        {/* Edit */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showEdit ? '16px' : 0 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Edit user</div>
            {!showEdit && (
              <button className="btn btn-sm" onClick={() => {
                dispatchEdit({ type: 'init', payload: { name: user.name || {}, email: user.email } })
                setShowEdit(true)
              }}>
                <i className="ti ti-edit" /> Edit
              </button>
            )}
          </div>
          {showEdit && (
            <form onSubmit={handleUpdate} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input className="form-input" value={editForm.name?.fName || ''}
                    onChange={e => dispatchEdit({ type: 'setName', field: 'fName', value: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name</label>
                  <input className="form-input" value={editForm.name?.lName || ''}
                    onChange={e => dispatchEdit({ type: 'setName', field: 'lName', value: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={editForm.email || ''}
                    onChange={e => dispatchEdit({ type: 'set', field: 'email', value: e.target.value })} />
                </div>
              </div>
              {editError && <div className="feedback-error">{editError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Roles */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-title">Roles</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {user.roles?.length ? user.roles.map(role => (
              <span key={role.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                className={`badge badge-${role.role.toLowerCase()}`}>
                {role.role.toLowerCase()}
                <button onClick={() => runAction('Remove role', () => removeRole(id, role.role))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 2px', lineHeight: 1, color: 'inherit' }}
                  aria-label={`Remove ${role.role}`}>×</button>
              </span>
            )) : <span style={{ fontSize: '13px', color: 'var(--text-hint)' }}>No roles assigned</span>}
          </div>
          {availableToAssign.length > 0 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {availableToAssign.map(role => (
                <button key={role} className="btn btn-sm"
                  disabled={!!actionLoading}
                  onClick={() => runAction('Assign role', () => assignRole(id, role))}>
                  <i className="ti ti-plus" /> {role.toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card">
          <div className="card-title">Actions</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {user.status === 'ACTIVE' && !isSelf && (
              <button className="btn" disabled={!!actionLoading}
                onClick={() => runAction('Suspend', () => suspendUser(id))}>
                {actionLoading === 'Suspend' ? 'Suspending...' : 'Suspend user'}
              </button>
            )}
            {user.status === 'SUSPENDED' && (
              <button className="btn" disabled={!!actionLoading}
                onClick={() => runAction('Reactivate', () => reactivateUser(id))}>
                {actionLoading === 'Reactivate' ? 'Reactivating...' : 'Reactivate user'}
              </button>
            )}
            {user.status === 'PENDING_ACTIVATION' && (
              <button className="btn" disabled={!!actionLoading}
                onClick={() => runAction('Resend activation', () => resendActivationEmail(id))}>
                {actionLoading === 'Resend activation' ? 'Sending...' : 'Resend activation email'}
              </button>
            )}
            {user.userMfa?.mfaSecret && !isSelf && (
              <button className="btn" disabled={!!actionLoading}
                onClick={() => runAction('Reset 2FA', () => reset2fa(id))}>
                {actionLoading === 'Reset 2FA' ? 'Resetting...' : 'Reset 2FA'}
              </button>
            )}
            {!isSelf && user.status === 'ACTIVE' && (
              <button className="btn" disabled={!!actionLoading}
                onClick={() => runAction('Force logout', () => forceLogoutUser(id))}>
                {actionLoading === 'Force logout' ? 'Logging out...' : 'Force logout'}
              </button>
            )}
            {!isSelf && (
              <button className="btn btn-danger" disabled={!!actionLoading} onClick={handleDelete}>
                <i className="ti ti-trash" /> Delete user
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}