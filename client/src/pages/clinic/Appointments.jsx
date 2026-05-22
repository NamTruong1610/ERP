import { useState, useEffect, useRef, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import {
  getAllAppointments,
  getMyAppointments,
  createAppointment
} from '../../api/clinic'
import { getAllPatients } from '../../api/clinic'
import { getDentists } from '../../api/user'
import AppSidebar from '../../components/AppSidebar'
import './clinic.css'

const STATUS_BADGE = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled'
}

const initialForm = {
  dentistId: '',
  patientId: '',
  date: '',
  notes: ''
}

function formReducer(state, action) {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value }
    case 'reset':
      return initialForm
    default:
      return state
  }
}

function CreateAppointmentModal({ onClose, onCreated }) {
  const [form, dispatch] = useReducer(formReducer, initialForm)
  const [patients, setPatients] = useState([])
  const [dentists, setDentists] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [pData, dData] = await Promise.all([getAllPatients(), getDentists()])
        setPatients(pData.patients)
        setDentists(dData.dentists)
      } catch {
        setError('Failed to load options')
      }
    }
    loadOptions()
  }, [])

  const handleChange = (e) => {
    dispatch({ type: 'setField', field: e.target.name, value: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createAppointment(form)
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
        <div className="modal-title">Schedule appointment</div>
        <form onSubmit={handleSubmit} className="clinic-form">
          <div className="form-group">
            <label>Patient *</label>
            <select name="patientId" value={form.patientId} onChange={handleChange} required>
              <option value="">Select patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Dentist *</label>
            <select name="dentistId" value={form.dentistId} onChange={handleChange} required>
              <option value="">Select dentist</option>
              {dentists.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name ? `${d.name.fName} ${d.name.lName}` : d.email}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date & Time *</label>
            <input
              name="date"
              type="datetime-local"
              value={form.date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any notes for this appointment..."
            />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Appointments() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const searchRef = useRef(null)

  const [appointments, setAppointments] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchAppointments = async () => {
    try {
      const data = isAdmin()
        ? await getAllAppointments()
        : await getMyAppointments()
      setAppointments(data.appointments)
      setFiltered(data.appointments)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => { await fetchAppointments() }
    load()
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      appointments.filter(a =>
        a.patient?.firstName.toLowerCase().includes(q) ||
        a.patient?.lastName.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q) ||
        a.treatment?.procedure?.toLowerCase().includes(q)
      )
    )
  }, [search, appointments])

  const formatDateTime = (d) => new Date(d).toLocaleString()

  return (
    <div className="clinic-layout">
      <AppSidebar active="appointments" />

      <main className="clinic-main">
        <div className="clinic-page-header">
          <div>
            <div className="clinic-page-title">Appointments</div>
            <div className="clinic-page-subtitle">{appointments.length} total appointments</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              ref={searchRef}
              className="search-bar"
              placeholder="Search by patient, status..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New appointment
            </button>
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="clinic-loading">Loading appointments...</div>
        ) : filtered.length === 0 ? (
          <div className="clinic-empty">No appointments found</div>
        ) : (
          <div className="clinic-table-wrap">
            <table className="clinic-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Dentist</th>
                  <th>Status</th>
                  <th>Procedure</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(appt => (
                  <tr
                    key={appt.id}
                    onClick={() => navigate(`/clinic/appointments/${appt.id}`)}
                  >
                    <td>{formatDateTime(appt.date)}</td>
                    <td>{appt.patient?.firstName} {appt.patient?.lastName}</td>
                    <td>
                      {appt.dentist?.name
                        ? `${appt.dentist.name.fName} ${appt.dentist.name.lName}`
                        : appt.dentist?.email}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[appt.status]}`}>
                        {appt.status}
                      </span>
                    </td>
                    <td>{appt.treatment?.procedure || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showCreate && (
          <CreateAppointmentModal
            onClose={() => setShowCreate(false)}
            onCreated={fetchAppointments}
          />
        )}
      </main>
    </div>
  )
}