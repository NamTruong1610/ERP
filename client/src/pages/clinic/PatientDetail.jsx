import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getPatient, updatePatient, deletePatient } from '../../api/clinic'
import AppSidebar from '../../components/AppSidebar'
import './clinic.css'

const STATUS_BADGE = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled'
}

function editReducer(state, action) {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value }
    case 'init':
      return action.payload
    default:
      return state
  }
}

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, dispatchEdit] = useReducer(editReducer, {})
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const fetchPatient = async () => {
    try {
      const data = await getPatient(id)
      setPatient(data.patient)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patient')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => { await fetchPatient() }
    load()
  }, [id])

  const startEdit = () => {
    dispatchEdit({
      type: 'init',
      payload: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob.split('T')[0],
        gender: patient.gender,
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || ''
      }
    })
    setShowEdit(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      await updatePatient(id, editForm)
      setFeedback('Patient updated successfully')
      setShowEdit(false)
      await fetchPatient()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this patient? This cannot be undone.')) return
    try {
      await deletePatient(id)
      navigate('/clinic/patients')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const formatDate = (d) => new Date(d).toLocaleDateString()
  const formatDateTime = (d) => new Date(d).toLocaleString()

  if (loading) return <div className="clinic-loading">Loading patient...</div>
  if (!patient) return <div className="clinic-loading">{error || 'Patient not found'}</div>

  return (
    <div className="clinic-layout">
      <AppSidebar active="patients" />

      <main className="clinic-main">
        <Link to="/clinic/patients" className="back-link">← Back to patients</Link>

        <div className="clinic-page-header">
          <div>
            <div className="clinic-page-title">{patient.firstName} {patient.lastName}</div>
            <div className="clinic-page-subtitle">DOB: {formatDate(patient.dob)} · {patient.gender}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={startEdit}>Edit</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {/* ── Patient Details ── */}
        <div className="clinic-detail-grid">
          <div className="clinic-card">
            <div className="clinic-card-label">Phone</div>
            <div className="clinic-card-value">{patient.phone || '—'}</div>
          </div>
          <div className="clinic-card">
            <div className="clinic-card-label">Email</div>
            <div className="clinic-card-value">{patient.email || '—'}</div>
          </div>
          <div className="clinic-card">
            <div className="clinic-card-label">Address</div>
            <div className="clinic-card-value">{patient.address || '—'}</div>
          </div>
          <div className="clinic-card">
            <div className="clinic-card-label">Registered</div>
            <div className="clinic-card-value">{formatDateTime(patient.createdAt)}</div>
          </div>
        </div>

        {/* ── Edit Form ── */}
        {showEdit && (
          <div className="clinic-card" style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Edit patient</div>
            <form onSubmit={handleUpdate} className="clinic-form">
              <div className="form-row">
                <div className="form-group">
                  <label>First name</label>
                  <input
                    value={editForm.firstName}
                    onChange={e => dispatchEdit({ type: 'setField', field: 'firstName', value: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last name</label>
                  <input
                    value={editForm.lastName}
                    onChange={e => dispatchEdit({ type: 'setField', field: 'lastName', value: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date of birth</label>
                  <input
                    type="date"
                    value={editForm.dob}
                    onChange={e => dispatchEdit({ type: 'setField', field: 'dob', value: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={e => dispatchEdit({ type: 'setField', field: 'gender', value: e.target.value })}
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    value={editForm.phone}
                    onChange={e => dispatchEdit({ type: 'setField', field: 'phone', value: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => dispatchEdit({ type: 'setField', field: 'email', value: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  value={editForm.address}
                  onChange={e => dispatchEdit({ type: 'setField', field: 'address', value: e.target.value })}
                />
              </div>
              {editError && <div className="feedback-error">{editError}</div>}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Appointment History ── */}
        <div style={{ marginBottom: '16px', fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
          Appointment history
        </div>

        {patient.appointments?.length === 0 ? (
          <div className="clinic-empty">No appointments yet</div>
        ) : (
          <div className="clinic-table-wrap">
            <table className="clinic-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dentist</th>
                  <th>Status</th>
                  <th>Procedure</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {patient.appointments?.map(appt => (
                  <tr
                    key={appt.id}
                    onClick={() => navigate(`/clinic/appointments/${appt.id}`)}
                  >
                    <td>{formatDateTime(appt.date)}</td>
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
                    <td>{appt.treatment ? `$${appt.treatment.cost.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}