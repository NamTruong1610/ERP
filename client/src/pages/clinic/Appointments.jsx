import { useState, useEffect, useRef, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllAppointments, createAppointment, getAllPatients } from '../../api/clinic'
import { getDentists } from '../../api/user'
import AppSidebar from '../../components/AppSidebar'
import Pagination from '../../components/Pagination'
import '../../styles/global.css'

const STATUS_BADGE = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled'
}

const initialForm = { dentistId: '', patientId: '', date: '', notes: '' }

function formReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'reset': return initialForm
    default: return state
  }
}

function CreateAppointmentModal({ onClose, onCreated }) {
  const [form, dispatch] = useReducer(formReducer, initialForm)
  const [patients, setPatients] = useState([])
  const [dentists, setDentists] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      await createAppointment({
        ...form,
        dentistId: form.dentistId || undefined
      })
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
            <label className="form-label">Patient <span style={{ color: 'var(--danger-text)' }}>*</span></label>
            <select name="patientId" className="form-select" value={form.patientId} onChange={handleChange} required>
              <option value="">Select patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Dentist <span style={{ color: 'var(--text-hint)', fontSize: '11px' }}>(optional)</span></label>
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
            <label className="form-label">Date & time <span style={{ color: 'var(--danger-text)' }}>*</span></label>
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

const PAGE_SIZE = 20

export default function Appointments() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') || ''
  const skip   = parseInt(searchParams.get('skip') || '0')
  const take   = parseInt(searchParams.get('take') || String(PAGE_SIZE))

  const [inputValue,   setInputValue]   = useState(search)
  const [appointments, setAppointments] = useState([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [showCreate,   setShowCreate]   = useState(false)

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const data = await getAllAppointments({
        take,
        skip,
        search: search || undefined
      })
      setAppointments(data.appointments)
      setTotal(data.total)
    } catch {
      setError('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [searchParams])

  const handleSubmit = (e) => {
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

  const handlePageChange = (newSkip, newTake = take) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('skip', String(newSkip))
      next.set('take', String(newTake))
      return next
    })
  }

  const formatDateTime = (d) => new Date(d).toLocaleString('en-AU')

  return (
    <div className="app-layout">
      <AppSidebar active="appointments" />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">Appointments</div>
            <div className="page-subtitle">{total} total appointments</div>
          </div>
          <div className="page-actions">
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
              <div className="search-wrap">
                <i className="ti ti-search" aria-hidden="true" />
                <input
                  className="search-input"
                  placeholder="Search appointments..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                />
              </div>
              <button type="submit" className="btn">Search</button>
            </form>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <i className="ti ti-plus" aria-hidden="true" />
              New appointment
            </button>
          </div>
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
                {search ? 'Try a different search term' : 'Schedule your first appointment'}
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
                          {`${appt.patient?.firstName?.[0]}${appt.patient?.lastName?.[0]}`.toUpperCase()}
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
                      <span className={`badge ${STATUS_BADGE[appt.status]}`}>
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