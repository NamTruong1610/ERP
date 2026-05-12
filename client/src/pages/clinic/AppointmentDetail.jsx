import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getAppointment,
  updateAppointment,
  deleteAppointment,
  createTreatment,
  updateTreatment
} from '../../api/clinic'
import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/AppSidebar'
import './clinic.css'

const STATUS_BADGE = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled'
}

const initialTreatmentForm = {
  procedure: '',
  toothNumber: '',
  notes: '',
  cost: ''
}

function treatmentReducer(state, action) {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value }
    case 'init':
      return action.payload
    default:
      return state
  }
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

  const [showTreatmentForm, setShowTreatmentForm] = useState(false)
  const [treatmentForm, dispatchTreatment] = useReducer(treatmentReducer, initialTreatmentForm)
  const [treatmentError, setTreatmentError] = useState('')
  const [treatmentLoading, setTreatmentLoading] = useState(false)

  const fetchAppointment = async () => {
    try {
      const data = await getAppointment(id)
      setAppointment(data.appointment)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load appointment')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => { await fetchAppointment() }
    load()
  }, [id])

  const handleStatusChange = async (status) => {
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
        setFeedback('Treatment updated successfully')
      } else {
        await createTreatment({
          appointmentId: id,
          procedure: treatmentForm.procedure,
          toothNumber: treatmentForm.toothNumber ? parseInt(treatmentForm.toothNumber) : null,
          notes: treatmentForm.notes,
          cost: parseFloat(treatmentForm.cost)
        })
        setFeedback('Treatment recorded successfully')
      }
      setShowTreatmentForm(false)
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
    setShowTreatmentForm(true)
  }

  const formatDateTime = (d) => new Date(d).toLocaleString()

  if (loading) return <div className="clinic-loading">Loading appointment...</div>
  if (!appointment) return <div className="clinic-loading">{error || 'Appointment not found'}</div>

  const isCancelled = appointment.status === 'CANCELLED'
  const hasT = !!appointment.treatment

  return (
    <div className="clinic-layout">
      <AppSidebar active="appointments" />

      <main className="clinic-main">
        <Link to="/clinic/appointments" className="back-link">← Back to appointments</Link>

        <div className="clinic-page-header">
          <div>
            <div className="clinic-page-title">
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </div>
            <div className="clinic-page-subtitle">{formatDateTime(appointment.date)}</div>
          </div>
          <span className={`badge ${STATUS_BADGE[appointment.status]}`}>
            {appointment.status}
          </span>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {/* ── Appointment Details ── */}
        <div className="clinic-detail-grid">
          <div className="clinic-card">
            <div className="clinic-card-label">Patient</div>
            <div
              className="clinic-card-value"
              style={{ cursor: 'pointer', color: 'var(--accent)' }}
              onClick={() => navigate(`/clinic/patients/${appointment.patientId}`)}
            >
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </div>
          </div>
          <div className="clinic-card">
            <div className="clinic-card-label">Dentist</div>
            <div className="clinic-card-value">
              {appointment.dentist?.name
                ? `${appointment.dentist.name.fName} ${appointment.dentist.name.lName}`
                : appointment.dentist?.email}
            </div>
          </div>
          <div className="clinic-card">
            <div className="clinic-card-label">Date & Time</div>
            <div className="clinic-card-value">{formatDateTime(appointment.date)}</div>
          </div>
          <div className="clinic-card">
            <div className="clinic-card-label">Notes</div>
            <div className="clinic-card-value">{appointment.notes || '—'}</div>
          </div>
        </div>

        {/* ── Actions ── */}
        {!isCancelled && (
          <div className="clinic-card" style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text)' }}>
              Actions
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {appointment.status === 'SCHEDULED' && (
                <button
                  className="btn btn-ghost"
                  disabled={!!actionLoading}
                  onClick={() => handleStatusChange('CANCELLED')}
                >
                  {actionLoading === 'CANCELLED' ? 'Cancelling...' : 'Cancel appointment'}
                </button>
              )}
              {!hasT && !isCancelled && (
                <button
                  className="btn btn-primary"
                  onClick={() => { dispatchTreatment({ type: 'init', payload: initialTreatmentForm }); setShowTreatmentForm(true) }}
                >
                  Record treatment
                </button>
              )}
              {hasT && (
                <button className="btn btn-ghost" onClick={startEditTreatment}>
                  Edit treatment
                </button>
              )}
              {isAdmin() && (
                <button
                  className="btn btn-danger"
                  disabled={!!actionLoading}
                  onClick={handleDelete}
                >
                  Delete appointment
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Treatment Form ── */}
        {showTreatmentForm && (
          <div className="clinic-card" style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
              {hasT ? 'Edit treatment' : 'Record treatment'}
            </div>
            <form onSubmit={handleTreatmentSubmit} className="clinic-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Procedure *</label>
                  <input
                    value={treatmentForm.procedure}
                    onChange={e => dispatchTreatment({ type: 'setField', field: 'procedure', value: e.target.value })}
                    placeholder="e.g. Filling, Extraction, Cleaning"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tooth number (1–32)</label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    value={treatmentForm.toothNumber}
                    onChange={e => dispatchTreatment({ type: 'setField', field: 'toothNumber', value: e.target.value })}
                    placeholder="e.g. 14"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={treatmentForm.notes}
                  onChange={e => dispatchTreatment({ type: 'setField', field: 'notes', value: e.target.value })}
                  placeholder="Clinical notes..."
                />
              </div>
              <div className="form-group">
                <label>Cost (AUD) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={treatmentForm.cost}
                  onChange={e => dispatchTreatment({ type: 'setField', field: 'cost', value: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              {treatmentError && <div className="feedback-error">{treatmentError}</div>}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowTreatmentForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={treatmentLoading}>
                  {treatmentLoading ? 'Saving...' : 'Save treatment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Treatment Record ── */}
        {hasT && !showTreatmentForm && (
          <div className="clinic-card">
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px', color: 'var(--text)' }}>
              Treatment record
            </div>
            <div className="clinic-detail-grid">
              <div>
                <div className="clinic-card-label">Procedure</div>
                <div className="clinic-card-value">{appointment.treatment.procedure}</div>
              </div>
              <div>
                <div className="clinic-card-label">Tooth number</div>
                <div className="clinic-card-value">{appointment.treatment.toothNumber || '—'}</div>
              </div>
              <div>
                <div className="clinic-card-label">Cost</div>
                <div className="clinic-card-value">${appointment.treatment.cost.toFixed(2)}</div>
              </div>
              <div>
                <div className="clinic-card-label">Notes</div>
                <div className="clinic-card-value">{appointment.treatment.notes || '—'}</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}