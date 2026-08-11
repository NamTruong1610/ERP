import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getAppointment, updateAppointment, deleteAppointment,
  createTreatment, updateTreatment
} from '../../api/clinic'
import { createVisitFromAppointment, updateVisit } from '../../api/visit'
import { getDentists } from '../../api/user'
import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/layout/AppSidebar'
import { formatDateTime } from '../../lib/format'
import { APPOINTMENT_STATUS_BADGE } from '../../lib/labels'
import '../../styles/global.css'

const initialTreatment = { procedure: '', toothNumber: '', notes: '', amount: '' }

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

  const [visitLoading, setVisitLoading] = useState(false)
  const [completingVisit, setCompletingVisit] = useState(false)
  const [showTreatment, setShowTreatment] = useState(false)
  const [editingTreatmentId, setEditingTreatmentId] = useState(null) // null = creating new
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
      const data = await updateAppointment(id, {
        dentistId: editForm.dentistId,
        date: new Date(editForm.date).toISOString(),
        notes: editForm.notes
      })
      setAppointment(data.appointment)
      setFeedback('Appointment updated')
      setShowEdit(false)
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
      const data = await updateAppointment(id, { status })
      setAppointment(data.appointment)
      setFeedback(`Appointment marked as ${status.toLowerCase()}`)
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

  const handleStartVisit = async () => {
    setVisitLoading(true)
    setError('')
    try {
      await createVisitFromAppointment({ appointmentId: id })
      setFeedback('Visit started')
      await fetchAppointment()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start visit')
    } finally {
      setVisitLoading(false)
    }
  }

  const handleCompleteVisit = async () => {
    setCompletingVisit(true)
    setError('')
    setFeedback('')
    try {
      await updateVisit(appointment.visit.id, { status: 'COMPLETED' })
      setFeedback('Visit completed')
      await fetchAppointment()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete visit')
    } finally {
      setCompletingVisit(false)
    }
  }

  const openNewTreatment = () => {
    setEditingTreatmentId(null)
    dispatchTreatment({ type: 'init', payload: initialTreatment })
    setShowTreatment(true)
  }

  const openEditTreatment = (treatment) => {
    setEditingTreatmentId(treatment.id)
    dispatchTreatment({
      type: 'init',
      payload: {
        procedure: treatment.procedure,
        toothNumber: treatment.toothNumber?.toString() || '',
        notes: treatment.notes || '',
        amount: treatment.amount?.toString() || ''
      }
    })
    setShowTreatment(true)
  }

  const handleTreatmentSubmit = async (e) => {
    e.preventDefault()
    setTreatmentLoading(true)
    setTreatmentError('')
    try {
      if (editingTreatmentId) {
        await updateTreatment(editingTreatmentId, {
          procedure: treatmentForm.procedure,
          toothNumber: treatmentForm.toothNumber ? parseInt(treatmentForm.toothNumber) : null,
          notes: treatmentForm.notes,
          amount: parseFloat(treatmentForm.amount)
        })
        setFeedback('Treatment updated')
      } else {
        await createTreatment({
          visitId: appointment.visit.id,
          procedure: treatmentForm.procedure,
          toothNumber: treatmentForm.toothNumber ? parseInt(treatmentForm.toothNumber) : null,
          notes: treatmentForm.notes,
          amount: parseFloat(treatmentForm.amount)
        })
        setFeedback('Treatment recorded')
      }
      // The treatments list lives nested under appointment.visit — a refetch
      // is the simplest way to keep both the visit and its list in sync.
      await fetchAppointment()
      setShowTreatment(false)
    } catch (err) {
      setTreatmentError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setTreatmentLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading appointment...</div>
  if (!appointment) return <div className="loading">{error || 'Appointment not found'}</div>

  const isCancelled = appointment.status === 'CANCELLED'
  const isCompleted = appointment.status === 'COMPLETED'
  const visit = appointment.visit
  const treatments = visit?.treatments || []
  const visitClosed = visit && (visit.status === 'COMPLETED' || visit.status === 'CANCELLED')
  const canDeleteAppointment = visit == null

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
          <span className={`badge ${APPOINTMENT_STATUS_BADGE[appointment.status]}`}>
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
        {isCompleted ? (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div className="empty" style={{ padding: '12px 0' }}>
              <div className="empty-subtitle">This appointment is complete and can no longer be edited or deleted.</div>
            </div>
          </div>
        ) : (!isCancelled || isAdmin()) && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!isCancelled && (
                <>
                  <button className="btn" onClick={startEdit}>
                    <i className="ti ti-edit" aria-hidden="true" /> Edit appointment
                  </button>
                  {appointment.status === 'SCHEDULED' && (
                    <button className="btn" disabled={!!actionLoading} onClick={() => handleStatus('CANCELLED')}>
                      {actionLoading === 'CANCELLED' ? 'Cancelling...' : 'Cancel appointment'}
                    </button>
                  )}
                  {visit == null && (
                    <button className="btn btn-primary" disabled={visitLoading} onClick={handleStartVisit}>
                      {visitLoading ? 'Starting...' : (<><i className="ti ti-player-play" aria-hidden="true" /> Start visit</>)}
                    </button>
                  )}
                  {visit && !visitClosed && (
                    <button className="btn btn-primary" onClick={openNewTreatment}>
                      <i className="ti ti-plus" aria-hidden="true" /> Add treatment
                    </button>
                  )}
                  {visit && !visitClosed && (
                    <button className="btn" disabled={completingVisit} onClick={handleCompleteVisit}>
                      {completingVisit ? 'Completing...' : (<><i className="ti ti-check" aria-hidden="true" /> Complete visit</>)}
                    </button>
                  )}
                </>
              )}
              {isCancelled && (
                <button className="btn" disabled={!!actionLoading} onClick={() => handleStatus('SCHEDULED')}>
                  {actionLoading === 'SCHEDULED' ? 'Restoring...' : 'Restore appointment'}
                </button>
              )}
              {isAdmin() && canDeleteAppointment && (
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
            <div className="card-title">{editingTreatmentId ? 'Edit treatment' : 'Record treatment'}</div>
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
                  value={treatmentForm.amount}
                  onChange={e => dispatchTreatment({ type: 'set', field: 'amount', value: e.target.value })}
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
        {visit && treatments.length > 0 && !showTreatment && (
          <div className="card">
            <div className="card-title">Treatments ({treatments.length})</div>
            {treatments.map((t, i) => (
              <div key={t.id}>
                <div className="detail-grid" style={{ marginBottom: 0 }}>
                  <div className="detail-item">
                    <div className="detail-label">Procedure</div>
                    <div className="detail-value">{t.procedure}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Tooth number</div>
                    <div className="detail-value">{t.toothNumber || '—'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Cost</div>
                    <div className="detail-value">${t.amount.toFixed(2)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Notes</div>
                    <div className="detail-value">{t.notes || '—'}</div>
                  </div>
                  {!visitClosed && (
                    <div className="detail-item">
                      <button className="btn btn-sm" onClick={() => openEditTreatment(t)}>
                        <i className="ti ti-edit" aria-hidden="true" /> Edit
                      </button>
                    </div>
                  )}
                </div>
                {i < treatments.length - 1 && <div className="divider" />}
              </div>
            ))}
          </div>
        )}
        {visit && treatments.length === 0 && !showTreatment && (
          <div className="card">
            <div className="empty">
              <i className="ti ti-stethoscope" aria-hidden="true" />
              <div className="empty-title">No treatments recorded yet</div>
              <div className="empty-subtitle">Add a treatment once the visit is underway.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}