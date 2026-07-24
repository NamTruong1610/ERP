import { useState, useEffect, useRef, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllPatients, createPatient } from '../../api/clinic'
import AppSidebar from '../../components/layout/AppSidebar'
import Pagination from '../../components/ui/Pagination'
import '../../styles/global.css'

// ── Constants ──────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear()

const DATE_PRESET_OPTIONS = [
  { value: '', label: 'Custom range' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  ...Array.from(
    { length: currentYear - 2024 + 1 },
    (_, i) => currentYear - i
  ).map(y => ({ value: String(y), label: String(y) }))
]

// Resolves a preset string into { from, to } ISO strings.
// All dates computed in local time so midnight means local midnight,
// not UTC midnight — avoids timezone boundary issues.
const resolvePreset = (preset) => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (preset === 'today') return {
    from: startOfToday.toISOString(),
    to: endOfToday.toISOString()
  }

  if (preset === '7d' || preset === '30d' || preset === '90d') {
    const days = parseInt(preset)
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - (days - 1))
    return {
      from: from.toISOString(),
      to: endOfToday.toISOString()
    }
  }

  if (/^\d{4}$/.test(preset)) return {
    from: new Date(parseInt(preset), 0, 1, 0, 0, 0, 0).toISOString(),
    to: new Date(parseInt(preset), 11, 31, 23, 59, 59, 999).toISOString()
  }

  return { from: '', to: '' }
}

// ── CreatePatientModal ─────────────────────────────────────────────────────────

const initialForm = {
  firstName: '', lastName: '', dob: '', gender: '',
  phone: '', email: '', address: ''
}

function formReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'reset': return initialForm
    default: return state
  }
}

function CreatePatientModal({ onClose, onCreated }) {
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
      await createPatient(form)
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
          <div className="modal-title">Register new patient</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First name <span>*</span></label>
              <input ref={firstRef} name="firstName" className="form-input"
                value={form.firstName} onChange={handleChange} placeholder="John" required />
            </div>
            <div className="form-group">
              <label className="form-label">Last name <span>*</span></label>
              <input name="lastName" className="form-input"
                value={form.lastName} onChange={handleChange} placeholder="Doe" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date of birth <span>*</span></label>
              <input name="dob" type="date" className="form-input"
                value={form.dob} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Gender <span>*</span></label>
              <select name="gender" className="form-select" value={form.gender} onChange={handleChange} required>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input name="phone" className="form-input"
                value={form.phone} onChange={handleChange} placeholder="0412 345 678" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input name="email" type="email" className="form-input"
                value={form.email} onChange={handleChange} placeholder="john@example.com" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input name="address" className="form-input"
              value={form.address} onChange={handleChange} placeholder="123 Main St, Sydney" />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Patients page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function Patients() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // All filter state read from URL
  const search = searchParams.get('search') || ''
  const preset = searchParams.get('preset') || ''
  const fromDate = searchParams.get('from') || ''
  const toDate = searchParams.get('to') || ''
  const skip = parseInt(searchParams.get('skip') || '0')
  const take = parseInt(searchParams.get('take') || String(PAGE_SIZE))

  // Local input state — only synced to URL on form submit
  const [inputValue, setInputValue] = useState(search)
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // Resolve effective from/to — preset takes priority over manual range
  const resolved = preset ? resolvePreset(preset) : { from: fromDate, to: toDate }

  const fetchPatients = async () => {
    try {
      setLoading(true)
      const data = await getAllPatients({
        take,
        skip,
        search: search || undefined,
        from: resolved.from || undefined,
        to: resolved.to || undefined,
      })
      setPatients(data.patients)
      setTotal(data.total)
    } catch {
      setError('Failed to load patients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPatients() }, [searchParams])

  // Search submitted — write to URL, reset to page 1
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (inputValue.trim()) {
        next.set('search', inputValue.trim())
      } else {
        next.delete('search')
      }
      next.set('skip', '0')
      return next
    })
  }

  // Preset selected — write to URL, clear manual range
  const handlePresetChange = (value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set('preset', value)
      } else {
        next.delete('preset')
      }
      next.delete('from')
      next.delete('to')
      next.set('skip', '0')
      return next
    })
  }

  // Manual date changed — write to URL, clear preset
  const handleDateChange = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      next.delete('preset')
      next.set('skip', '0')
      return next
    })
  }

  const clearFilters = () => {
    setInputValue('')
    setSearchParams({})
  }

  const handlePageChange = (newSkip, newTake = take) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('skip', String(newSkip))
      next.set('take', String(newTake))
      return next
    })
  }

  const hasActiveFilters = search || preset || fromDate || toDate
  const initials = (p) => `${p.firstName[0]}${p.lastName[0]}`.toUpperCase()
  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU')

  return (
    <div className="app-layout">
      <AppSidebar active="patients" />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Patients</div>
            <div className="page-subtitle">{total} total patients</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> New patient
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div className="search-wrap">
              <i className="ti ti-search" aria-hidden="true" />
              <input
                className="search-input"
                placeholder="Search patients..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              />
            </div>
            <button type="submit" className="btn">Search</button>
          </form>

          {/* Date preset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Registered
            </label>
            <select
              className="form-select"
              value={preset}
              onChange={e => handlePresetChange(e.target.value)}
              style={{ width: 'auto' }}
            >
              {DATE_PRESET_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              From
            </label>
            <input
              type="date"
              className="form-input"
              value={fromDate}
              onChange={e => handleDateChange('from', e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>

          {/* To date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              To
            </label>
            <input
              type="date"
              className="form-input"
              value={toDate}
              onChange={e => handleDateChange('to', e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={clearFilters}
              style={{ color: 'var(--text-hint)', fontSize: '12px', alignSelf: 'flex-end' }}
            >
              <i className="ti ti-x" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="loading">Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-users" aria-hidden="true" />
              <div className="empty-title">No patients found</div>
              <div className="empty-subtitle">
                {hasActiveFilters
                  ? 'Try adjusting your search or filters'
                  : 'Register your first patient to get started'}
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date of birth</th>
                  <th>Gender</th>
                  <th>Phone</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/clinic/patients/${p.id}`)}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar">{initials(p)}</div>
                        {p.firstName} {p.lastName}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(p.dob)}</td>
                    <td>{p.gender}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.phone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.email || '—'}</td>
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
          <CreatePatientModal
            onClose={() => setShowCreate(false)}
            onCreated={() => fetchPatients()}
          />
        )}
      </main>
    </div>
  )
}