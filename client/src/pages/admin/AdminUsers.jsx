import { useState, useEffect, useRef, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllUsers, createUser } from '../../api/admin'
import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/AppSidebar'
import Pagination from '../../components/Pagination'
import '../../styles/global.css'

const STATUS_BADGE = {
  ACTIVE: 'badge-active',
  SUSPENDED: 'badge-suspended',
  PENDING_ACTIVATION: 'badge-pending',
  PENDING_MFA_SETUP: 'badge-pending',
  PENDING_MFA_VERIFICATION: 'badge-pending',
}

const initialForm = { email: '' }

function formReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'reset': return initialForm
    default: return state
  }
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, dispatch] = useReducer(formReducer, initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const firstRef = useRef(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  const handleChange = (e) => {
    dispatch({ type: 'set', field: e.target.name, value: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createUser(form)
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
        <div className="modal-header">
          <div className="modal-title">Create new user</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label className="form-label">Email <span style={{ color: 'var(--danger-text)' }}>*</span></label>
            <input ref={firstRef} name="email" type="email" className="form-input"
              value={form.email} onChange={handleChange} placeholder="user@example.com" required />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

export default function AdminUsers() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const searchRef = useRef(null)

  const [users,   setUsers]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [skip,    setSkip]    = useState(0)
  const [take,    setTake]    = useState(PAGE_SIZE)
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchUsers = async (query = search, newSkip = skip, newTake = take) => {
    try {
      setLoading(true)
      const data = await getAllUsers(query || undefined, { take: newTake, skip: newSkip })
      setUsers(data.users)
      setTotal(data.total)
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchUsers()
    searchRef.current?.focus()
  }, [])

  // Debounced search — resets to page 1
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSkip(0)
      fetchUsers(search, 0, take)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  const handlePageChange = (newSkip, newTake = take) => {
    setSkip(newSkip)
    if (newTake !== take) setTake(newTake)
    fetchUsers(search, newSkip, newTake)
  }

  const formatName = (name) => {
    if (!name) return '—'
    return [name.fName, name.lName].filter(Boolean).join(' ') || '—'
  }

  const initials = (u) => {
    if (u.name?.fName && u.name?.lName) return `${u.name.fName[0]}${u.name.lName[0]}`.toUpperCase()
    return u.email[0].toUpperCase()
  }

  const handleRowClick = (u) => {
    if (u.id === currentUser?.id) {
      navigate('/profile')
    } else {
      navigate(`/admin/users/${u.id}`)
    }
  }

  return (
    <div className="app-layout">
      <AppSidebar active="admin" />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">User management</div>
            <div className="page-subtitle">{total} total users</div>
          </div>
          <div className="page-actions">
            <div className="search-wrap">
              <i className="ti ti-search" aria-hidden="true" />
              <input ref={searchRef} className="search-input"
                placeholder="Search users..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <i className="ti ti-plus" aria-hidden="true" /> New user
            </button>
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-users" aria-hidden="true" />
              <div className="empty-title">No users found</div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Roles</th>
                  <th>2FA</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} onClick={() => handleRowClick(u)}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar">{initials(u)}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {formatName(u.name)}
                            {u.id === currentUser?.id && (
                              <span style={{ fontSize: '11px', color: 'var(--text-hint)', marginLeft: '6px' }}>
                                (you)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[u.status] || 'badge-pending'}`}>
                        {u.status.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {u.roles?.map(r => (
                          <span key={r.id} className={`badge badge-${r.role.toLowerCase()}`}>{r.role.toLowerCase()}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.userMfa?.enabled ? 'badge-active' : 'badge-pending'}`}>
                        {u.userMfa?.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              skip={skip}
              take={take}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {showCreate && (
          <CreateUserModal
            onClose={() => setShowCreate(false)}
            onCreated={() => fetchUsers(search, 0, take)}
          />
        )}
      </main>
    </div>
  )
}