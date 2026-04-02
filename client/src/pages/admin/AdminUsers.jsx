import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { getAllUsers, createUser } from '../../api/admin'
import { logout } from '../../api/auth'
import './admin.css'
 
const STATUS_BADGE = {
  ACTIVE: 'badge-active',
  SUSPENDED: 'badge-suspended',
  PENDING_ACTIVATION: 'badge-pending',
  PENDING_MFA_SETUP: 'badge-pending',
  PENDING_MFA_VERIFICATION: 'badge-pending',
}
 
function CreateUserModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
 
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createUser({ email })
      onCreated()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
 
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Create user</div>
        <div className="modal-subtitle">
          An activation email will be sent to the provided address.
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="user@example.com"
              required
              autoFocus
            />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
 
export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const { logoutUser } = useAuth()
 
  const fetchUsers = async () => {
    try {
      const data = await getAllUsers()
      setUsers(data.users)
      setFiltered(data.users)
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) navigate('/login')
      else setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }
 
  useEffect(() => {
    const load = async () => {
      await fetchUsers()
    }
    load()
  }, [])
 
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      users.filter(u =>
        u.email.toLowerCase().includes(q) ||
        u.status.toLowerCase().includes(q) ||
        (u.name?.fName || '').toLowerCase().includes(q) ||
        (u.name?.lName || '').toLowerCase().includes(q)
      )
    )
  }, [search, users])
 
  const handleLogout = async () => {
    await logout()
    logoutUser()
    navigate('/login')
  }
 
  const formatName = (name) => {
    if (!name) return '—'
    return [name.fName, name.lName].filter(Boolean).join(' ') || '—'
  }
 
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          ERP
          <div className="sidebar-role">Admin</div>
        </div>
        <nav className="sidebar-nav">
          <Link to="/profile" className="sidebar-link">← Back to profile</Link>
          <Link to="/admin/users" className="sidebar-link active">Users</Link>
          <button className="sidebar-link danger" onClick={handleLogout}>Sign out</button>
        </nav>
      </aside>
 
      <main className="admin-main">
        <div className="page-header">
          <div>
            <div className="page-title">Users</div>
            <div className="page-subtitle">{users.length} total users</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              className="search-bar"
              placeholder="Search by name, email, status..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create user
            </button>
          </div>
        </div>
 
        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
 
        {loading ? (
          <div className="admin-loading">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No users found</div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Roles</th>
                  <th>2FA</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user._id} onClick={() => navigate(`/admin/users/${user._id}`)}>
                    <td>{formatName(user.name)}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[user.status] || 'badge-pending'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{user.roles?.join(', ') || '—'}</td>
                    <td>{user.mfaEnabled ? '✓' : '—'}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
 
        {showCreate && (
          <CreateUserModal
            onClose={() => setShowCreate(false)}
            onCreated={fetchUsers}
          />
        )}
      </main>
    </div>
  )
}