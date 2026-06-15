import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getAppointment, updateAppointment, deleteAppointment,
  createTreatment, updateTreatment
} from '../../api/clinic'
import { getDentists } from '../../api/user'
import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/AppSidebar'
import '../../styles/global.css'

const STATUS_BADGE = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled'
}

const initialTreatment = { procedure: '', toothNumber: '', notes: '', cost: '' }

function reducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'init': return action.payload
    default: return state
  }
}

const formatDentist = (dentist) => {
  if (!dentist) return 'Dentist unassigned'
  if (dentist.name?.fName) return `${dentist.name.fName} ${dentist.name.lName}`
  return dentist.email
}

const toLocalDatetimeValue = (isoString) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, dispatchEdit] = useReducer(reducer, {})
  const [dentists, setDentists] = useState([])
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [showTreatment, setShowTreatment] = useState(false)
  const [treatmentForm, dispatchTreatment] = useReducer(reducer, initialTreatment)
  const [treatmentError, setTreatmentError] = useState('')
  const [treatmentLoading, setTreatmentLoading] = useState(false)

  const fetchAppointment = async () => {
    try {
      const data = await getAppointment(id)
      setAppointment(data.appointment)
    } catch {
      setError('Failed to load appointment')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAppointment() }, [id])

  const startEdit = async () => {
    if (!dentists.length) {
      try {
        const data = await getDentists()
        setDentists(data.dentists)
      } catch {
        setEditError('Failed to load dentists')
      }
    }
    dispatchEdit({
      type: 'init',
      payload: {
        dentistId: appointment.dentistId || '',
        date: toLocalDatetimeValue(appointment.date),
        notes: appointment.notes || ''
      }
    })
    setShowEdit(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      await updateAppointment(id, {
        dentistId: editForm.dentistId,
        date: new Date(editForm.date).toISOString(),
        notes: editForm.notes
      })
      setFeedback('Appointment updated')
      setShowEdit(false)
      await fetchAppointment()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEditLoading(false)
    }
  }

  const handleStatus = async (status) => {
    setActionLoading(status)
    setError('')
    setFeedback('')
    try {
      await updateAppointment(id, { status })
      setFeedback(`Appointment marked as ${status.toLowerCase()}`)
      await fetchAppointment()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setActionLoading('')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this appointment?')) return
    try {
      await deleteAppointment(id)
      navigate('/clinic/appointments')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const handleTreatmentSubmit = async (e) => {
    e.preventDefault()
    setTreatmentLoading(true)
    setTreatmentError('')
    try {
      if (appointment.treatment) {
        await updateTreatment(appointment.treatment.id, {
          procedure: treatmentForm.procedure,
          toothNumber: treatmentForm.toothNumber ? parseInt(treatmentForm.toothNumber) : null,
          notes: treatmentForm.notes,
          cost: parseFloat(treatmentForm.cost)
        })
        setFeedback('Treatment updated')
      } else {
        await createTreatment({
          appointmentId: id,
          procedure: treatmentForm.procedure,
          toothNumber: treatmentForm.toothNumber ? parseInt(treatmentForm.toothNumber) : null,
          notes: treatmentForm.notes,
          cost: parseFloat(treatmentForm.cost)
        })
        setFeedback('Treatment recorded')
      }
      setShowTreatment(false)
      await fetchAppointment()
    } catch (err) {
      setTreatmentError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setTreatmentLoading(false)
    }
  }

  const startEditTreatment = () => {
    dispatchTreatment({
      type: 'init',
      payload: {
        procedure: appointment.treatment?.procedure || '',
        toothNumber: appointment.treatment?.toothNumber?.toString() || '',
        notes: appointment.treatment?.notes || '',
        cost: appointment.treatment?.cost?.toString() || ''
      }
    })
    setShowTreatment(true)
  }

  const formatDateTime = (d) => new Date(d).toLocaleString('en-AU')

  if (loading) return <div className="loading">Loading appointment...</div>
  if (!appointment) return <div className="loading">{error || 'Appointment not found'}</div>

  const isCancelled = appointment.status === 'CANCELLED'
  const hasT = !!appointment.treatment

  return (
    <div className="app-layout">
      <AppSidebar active="appointments" />
      <main className="main">
        <Link to="/clinic/appointments" className="back-link">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to appointments
        </Link>

        <div className="page-header">
          <div>
            <div className="page-title">
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </div>
            <div className="page-subtitle">{formatDateTime(appointment.date)}</div>
          </div>
          <span className={`badge ${STATUS_BADGE[appointment.status]}`}>
            {appointment.status.toLowerCase()}
          </span>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {/* Details */}
        <div className="detail-grid">
          <div className="detail-item" style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/clinic/patients/${appointment.patientId}`)}>
            <div className="detail-label">Patient</div>
            <div className="detail-value" style={{ color: 'var(--primary)' }}>
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Dentist</div>
            <div className="detail-value" style={{ color: !appointment.dentist ? 'var(--text-hint)' : 'inherit' }}>
              {formatDentist(appointment.dentist)}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Date & time</div>
            <div className="detail-value">{formatDateTime(appointment.date)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Notes</div>
            <div className="detail-value">{appointment.notes || '—'}</div>
          </div>
        </div>

        {/* Actions — shown for admins always, for staff only when not cancelled */}
        {(!isCancelled || isAdmin()) && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!isCancelled && (
                <>
                  <button className="btn" onClick={startEdit}>
                    <i className="ti ti-edit" aria-hidden="true" /> Edit appointment
                  </button>
                  {appointment.status === 'SCHEDULED' && (
                    <button className="btn" disabled={!!actionLoading}
                      onClick={() => handleStatus('CANCELLED')}>
                      {actionLoading === 'CANCELLED' ? 'Cancelling...' : 'Cancel appointment'}
                    </button>
                  )}
                  {!hasT && (
                    <button className="btn btn-primary"
                      onClick={() => { dispatchTreatment({ type: 'init', payload: initialTreatment }); setShowTreatment(true) }}>
                      <i className="ti ti-plus" aria-hidden="true" /> Record treatment
                    </button>
                  )}
                  {hasT && (
                    <button className="btn" onClick={startEditTreatment}>
                      <i className="ti ti-edit" aria-hidden="true" /> Edit treatment
                    </button>
                  )}
                </>
              )}
              {isAdmin() && (
                <button className="btn btn-danger" disabled={!!actionLoading} onClick={handleDelete}>
                  <i className="ti ti-trash" aria-hidden="true" /> Delete appointment
                </button>
              )}
            </div>
          </div>
        )}

        {/* Edit appointment form */}
        {showEdit && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Edit appointment</div>
            <form onSubmit={handleEditSubmit} className="form">
              <div className="form-group">
                <label className="form-label">Dentist</label>
                <select className="form-select" value={editForm.dentistId}
                  onChange={e => dispatchEdit({ type: 'set', field: 'dentistId', value: e.target.value })}>
                  <option value="">No dentist assigned</option>
                  {dentists.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name ? `${d.name.fName} ${d.name.lName}` : d.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date & time</label>
                <input type="datetime-local" className="form-input"
                  value={editForm.date}
                  onChange={e => dispatchEdit({ type: 'set', field: 'date', value: e.target.value })}
                  required />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={editForm.notes}
                  onChange={e => dispatchEdit({ type: 'set', field: 'notes', value: e.target.value })}
                  placeholder="Any notes for this appointment..." />
              </div>
              {editError && <div className="feedback-error">{editError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Treatment form */}
        {showTreatment && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">{hasT ? 'Edit treatment' : 'Record treatment'}</div>
            <form onSubmit={handleTreatmentSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Procedure <span style={{ color: 'var(--danger-text)' }}>*</span></label>
                  <input className="form-input" value={treatmentForm.procedure}
                    onChange={e => dispatchTreatment({ type: 'set', field: 'procedure', value: e.target.value })}
                    placeholder="e.g. Filling, Extraction, Cleaning" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tooth number (1–32)</label>
                  <input type="number" min="1" max="32" className="form-input"
                    value={treatmentForm.toothNumber}
                    onChange={e => dispatchTreatment({ type: 'set', field: 'toothNumber', value: e.target.value })}
                    placeholder="e.g. 14" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Clinical notes</label>
                <textarea className="form-textarea" value={treatmentForm.notes}
                  onChange={e => dispatchTreatment({ type: 'set', field: 'notes', value: e.target.value })}
                  placeholder="Clinical notes..." />
              </div>
              <div className="form-group">
                <label className="form-label">Cost (AUD) <span style={{ color: 'var(--danger-text)' }}>*</span></label>
                <input type="number" min="0" step="0.01" className="form-input"
                  value={treatmentForm.cost}
                  onChange={e => dispatchTreatment({ type: 'set', field: 'cost', value: e.target.value })}
                  placeholder="0.00" required />
              </div>
              {treatmentError && <div className="feedback-error">{treatmentError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowTreatment(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={treatmentLoading}>
                  {treatmentLoading ? 'Saving...' : 'Save treatment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Treatment record */}
        {hasT && !showTreatment && (
          <div className="card">
            <div className="card-title">Treatment record</div>
            <div className="detail-grid" style={{ marginBottom: 0 }}>
              <div className="detail-item">
                <div className="detail-label">Procedure</div>
                <div className="detail-value">{appointment.treatment.procedure}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Tooth number</div>
                <div className="detail-value">{appointment.treatment.toothNumber || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Cost</div>
                <div className="detail-value">${appointment.treatment.cost.toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Notes</div>
                <div className="detail-value">{appointment.treatment.notes || '—'}</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}