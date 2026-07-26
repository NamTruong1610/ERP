import { useState, useEffect, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllAppointments, createAppointment, getAllPatients } from '../../api/clinic'
import { getDentists } from '../../api/user'
import AppSidebar from '../../components/layout/AppSidebar'
import Pagination from '../../components/ui/Pagination'
import { formatDateTime } from '../../lib/format'
import { APPOINTMENT_STATUS_BADGE } from '../../lib/labels'
import '../../styles/global.css'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',           label: 'All statuses' },
  { value: 'SCHEDULED',  label: 'Scheduled' },
  { value: 'COMPLETED',  label: 'Completed' },
  { value: 'CANCELLED',  label: 'Cancelled' },
]

const currentYear = new Date().getFullYear()

const DATE_PRESET_OPTIONS = [
  { value: '',      label: 'Custom range' },
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
  { value: '90d',   label: 'Last 90 days' },
  ...Array.from(
    { length: currentYear - 2024 + 1 },
    (_, i) => currentYear - i
  ).map(y => ({ value: String(y), label: String(y) }))
]

const resolvePreset = (preset) => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (preset === 'today') return {
    from: startOfToday.toISOString(),
    to:   endOfToday.toISOString()
  }

  if (preset === '7d' || preset === '30d' || preset === '90d') {
    const days = parseInt(preset)
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - (days - 1))
    return { from: from.toISOString(), to: endOfToday.toISOString() }
  }

  if (/^\d{4}$/.test(preset)) return {
    from: new Date(parseInt(preset), 0, 1, 0, 0, 0, 0).toISOString(),
    to:   new Date(parseInt(preset), 11, 31, 23, 59, 59, 999).toISOString()
  }

  return { from: '', to: '' }
}

const PAGE_SIZE = 20

// ── CreateAppointmentModal ─────────────────────────────────────────────────────

const initialForm = { dentistId: '', patientId: '', date: '', notes: '' }

function formReducer(state, action) {
  switch (action.type) {
    case 'set':   return { ...state, [action.field]: action.value }
    case 'reset': return initialForm
    default:      return state
  }
}

function CreateAppointmentModal({ onClose, onCreated }) {
  const [form,     dispatch]  = useReducer(formReducer, initialForm)
  const [patients, setPatients] = useState([])
  const [dentists, setDentists] = useState([])
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [pData, dData] = await Promise.all([
          getAllPatients({ take: 1000, skip: 0 }),
          getDentists()
        ])
        setPatients(pData.patients)
        setDentists(dData.dentists)
      } catch {
        setError('Failed to load options')
      }
    }
    load()
  }, [])

  const handleChange = (e) => {
    dispatch({ type: 'set', field: e.target.name, value: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createAppointment({ ...form, dentistId: form.dentistId || undefined })
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
          <div className="modal-title">Schedule appointment</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label className="form-label">
              Patient <span style={{ color: 'var(--danger-text)' }}>*</span>
            </label>
            <select name="patientId" className="form-select" value={form.patientId} onChange={handleChange} required>
              <option value="">Select patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              Dentist{' '}
              <span style={{ color: 'var(--text-hint)', fontSize: '11px' }}>(optional)</span>
            </label>
            <select name="dentistId" className="form-select" value={form.dentistId} onChange={handleChange}>
              <option value="">Unassigned</option>
              {dentists.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name ? `${d.name.fName} ${d.name.lName}` : d.email}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              Date & time <span style={{ color: 'var(--danger-text)' }}>*</span>
            </label>
            <input name="date" type="datetime-local" className="form-input"
              value={form.date} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea name="notes" className="form-textarea"
              value={form.notes} onChange={handleChange}
              placeholder="Any notes for this appointment..." />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Appointments page ──────────────────────────────────────────────────────────

export default function Appointments() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // All filter state from URL
  const search   = searchParams.get('search') || ''
  const status   = searchParams.get('status') || ''
  const preset   = searchParams.get('preset') || ''
  const fromDate = searchParams.get('from')   || ''
  const toDate   = searchParams.get('to')     || ''
  const skip     = parseInt(searchParams.get('skip') || '0')
  const take     = parseInt(searchParams.get('take') || String(PAGE_SIZE))

  const [inputValue,   setInputValue]   = useState(search)
  const [appointments, setAppointments] = useState([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [showCreate,   setShowCreate]   = useState(false)

  const resolved = preset ? resolvePreset(preset) : { from: fromDate, to: toDate }

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const data = await getAllAppointments({
        take,
        skip,
        search: search        || undefined,
        status: status        || undefined,
        from:   resolved.from || undefined,
        to:     resolved.to   || undefined,
      })
      setAppointments(data.appointments)
      setTotal(data.total)
    } catch {
      setError('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAppointments() }, [searchParams])

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

  const handleStatusChange = (value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set('status', value)
      } else {
        next.delete('status')
      }
      next.set('skip', '0')
      return next
    })
  }

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

  const hasActiveFilters = search || status || preset || fromDate || toDate

  return (
    <div className="app-layout">
      <AppSidebar active="appointments" />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Appointments</div>
            <div className="page-subtitle">{total} total appointments</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> New appointment
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
                placeholder="Search by patient name..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              />
            </div>
            <button type="submit" className="btn">Search</button>
          </form>

          {/* Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Status
            </label>
            <select
              className="form-select"
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ width: 'auto' }}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Date preset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Appointment date
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
          <div className="loading">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-calendar" aria-hidden="true" />
              <div className="empty-title">No appointments found</div>
              <div className="empty-subtitle">
                {hasActiveFilters
                  ? 'Try adjusting your search or filters'
                  : 'Schedule your first appointment'}
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Dentist</th>
                  <th>Status</th>
                  <th>Procedure</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => (
                  <tr key={appt.id} onClick={() => navigate(`/clinic/appointments/${appt.id}`)}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar">
                          {`${appt.patient?.firstName?.[0] ?? ''}${appt.patient?.lastName?.[0] ?? ''}`.toUpperCase()}
                        </div>
                        {appt.patient?.firstName} {appt.patient?.lastName}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDateTime(appt.date)}</td>
                    <td>
                      {appt.dentist?.name
                        ? `${appt.dentist.name.fName} ${appt.dentist.name.lName}`
                        : appt.dentist?.email ?? <span style={{ color: 'var(--text-hint)' }}>Unassigned</span>
                      }
                    </td>
                    <td>
                      <span className={`badge ${APPOINTMENT_STATUS_BADGE[appt.status]}`}>
                        {appt.status.toLowerCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{appt.treatment?.procedure || '—'}</td>
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
          <CreateAppointmentModal
            onClose={() => setShowCreate(false)}
            onCreated={() => fetchAppointments()}
          />
        )}
      </main>
    </div>
  )
}