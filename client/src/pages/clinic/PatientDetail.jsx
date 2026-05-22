import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getPatient, updatePatient, deletePatient } from '../../api/clinic'
import AppSidebar from '../../components/AppSidebar'
import '../../styles/global.css'

const STATUS_BADGE = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled'
}

function editReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'init': return action.payload
    default: return state
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
    } catch {
      setError('Failed to load patient')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPatient() }, [id])

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
    if (!window.confirm('Delete this patient? This cannot be undone.')) return
    try {
      await deletePatient(id)
      navigate('/clinic/patients')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU')
  const formatDateTime = (d) => new Date(d).toLocaleString('en-AU')
  const initials = (p) => `${p.firstName[0]}${p.lastName[0]}`.toUpperCase()

  if (loading) return <div className="loading">Loading patient...</div>
  if (!patient) return <div className="loading">{error || 'Patient not found'}</div>

  return (
    <div className="app-layout">
      <AppSidebar active="patients" />
      <main className="main">
        <Link to="/clinic/patients" className="back-link">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to patients
        </Link>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="avatar" style={{ width: '44px', height: '44px', fontSize: '16px' }}>
              {initials(patient)}
            </div>
            <div>
              <div className="page-title">{patient.firstName} {patient.lastName}</div>
              <div className="page-subtitle">
                DOB: {formatDate(patient.dob)} · {patient.gender}
              </div>
            </div>
          </div>
          <div className="page-actions">
            <button className="btn" onClick={startEdit}>
              <i className="ti ti-edit" aria-hidden="true" /> Edit
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              <i className="ti ti-trash" aria-hidden="true" /> Delete
            </button>
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Phone</div>
            <div className="detail-value">{patient.phone || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Email</div>
            <div className="detail-value">{patient.email || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Address</div>
            <div className="detail-value">{patient.address || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Registered</div>
            <div className="detail-value">{formatDateTime(patient.createdAt)}</div>
          </div>
        </div>

        {showEdit && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-title">Edit patient</div>
            <form onSubmit={handleUpdate} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input className="form-input" value={editForm.firstName}
                    onChange={e => dispatchEdit({ type: 'set', field: 'firstName', value: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name</label>
                  <input className="form-input" value={editForm.lastName}
                    onChange={e => dispatchEdit({ type: 'set', field: 'lastName', value: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date of birth</label>
                  <input type="date" className="form-input" value={editForm.dob}
                    onChange={e => dispatchEdit({ type: 'set', field: 'dob', value: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={editForm.gender}
                    onChange={e => dispatchEdit({ type: 'set', field: 'gender', value: e.target.value })} required>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={editForm.phone}
                    onChange={e => dispatchEdit({ type: 'set', field: 'phone', value: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={editForm.email}
                    onChange={e => dispatchEdit({ type: 'set', field: 'email', value: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={editForm.address}
                  onChange={e => dispatchEdit({ type: 'set', field: 'address', value: e.target.value })} />
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

        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Appointment history
        </div>

        {!patient.appointments?.length ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-calendar" aria-hidden="true" />
              <div className="empty-title">No appointments yet</div>
              <div className="empty-subtitle">Appointments will appear here once scheduled</div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
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
                {patient.appointments.map(appt => (
                  <tr key={appt.id} onClick={() => navigate(`/clinic/appointments/${appt.id}`)}>
                    <td>{formatDateTime(appt.date)}</td>
                    <td>
                      {appt.dentist?.name
                        ? `${appt.dentist.name.fName} ${appt.dentist.name.lName}`
                        : appt.dentist?.email}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[appt.status]}`}>
                        {appt.status.toLowerCase()}
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