import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getPatient, updatePatient, deletePatient } from '../../api/clinic'
import { getPatientFiles, getDownloadUrl, softDeleteFile } from '../../api/files'
import FileUpload from '../../features/files/FileUpload'
import AppSidebar from '../../components/layout/AppSidebar'
import { formatDate, formatDateTime } from '../../lib/format'
import { APPOINTMENT_STATUS_BADGE, FILE_ICON } from '../../lib/labels'
import '../../styles/global.css'


function editReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'init': return action.payload
    default: return state
  }
}

const formatDentist = (dentist) => {
  if (!dentist) return 'Dentist removed'
  if (dentist.name?.fName) return `${dentist.name.fName} ${dentist.name.lName}`
  return dentist.email
}

const formatBytes = (n) => {
  if (n < 1024)         return `${n} B`
  if (n < 1024 * 1024)  return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  // ── Patient ────────────────────────────────────────────────────────────────
  const [patient,     setPatient]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [feedback,    setFeedback]    = useState('')
  const [showEdit,    setShowEdit]    = useState(false)
  const [editForm,    dispatchEdit]   = useReducer(editReducer, {})
  const [editError,   setEditError]   = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // ── Files ──────────────────────────────────────────────────────────────────
  const [files,         setFiles]         = useState([])
  const [loadingFiles,  setLoadingFiles]  = useState(true)
  const [downloading,   setDownloading]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting,      setDeleting]      = useState(null)

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

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true)
      const data = await getPatientFiles(id)
      setFiles(data.files)
    } catch {
      setError('Failed to load files')
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    fetchPatient()
    fetchFiles()
  }, [id])

  const startEdit = () => {
    dispatchEdit({
      type: 'init',
      payload: {
        firstName: patient.firstName,
        lastName:  patient.lastName,
        dob:       patient.dob.split('T')[0],
        gender:    patient.gender,
        phone:     patient.phone   || '',
        email:     patient.email   || '',
        address:   patient.address || ''
      }
    })
    setShowEdit(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      const data = await updatePatient(id, editForm)
      // updatePatient's response is patient scalars only (no appointments/files
      // relations) — merge rather than replace, since those didn't change.
      setPatient(prev => ({ ...prev, ...data.patient }))
      setFeedback('Patient updated successfully')
      setShowEdit(false)
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

  const handleDownload = async (file) => {
    setDownloading(file.id)
    try {
      const { downloadUrl } = await getDownloadUrl(file.id)
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Failed to generate download link')
    } finally {
      setDownloading(null)
    }
  }

  const handleDeleteFile = async (fileId) => {
    setConfirmDelete(null)
    setDeleting(fileId)
    try {
      await softDeleteFile(fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch {
      setError('Failed to delete file')
    } finally {
      setDeleting(null)
    }
  }

  const initials       = (p) => `${p.firstName[0]}${p.lastName[0]}`.toUpperCase()

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

        {error    && <div className="feedback-error"   style={{ marginBottom: '16px' }}>{error}</div>}
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

        {/* ── Edit form ── */}
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

        {/* ── Appointment history ── */}
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
          Appointment history
        </div>

        {!patient.appointments?.length ? (
          <div className="table-wrap" style={{ marginBottom: '32px' }}>
            <div className="empty">
              <i className="ti ti-calendar" aria-hidden="true" />
              <div className="empty-title">No appointments yet</div>
              <div className="empty-subtitle">Appointments will appear here once scheduled</div>
            </div>
          </div>
        ) : (
          <div className="table-wrap" style={{ marginBottom: '32px' }}>
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
                    <td style={{ color: !appt.dentist ? 'var(--text-hint)' : 'inherit' }}>
                      {formatDentist(appt.dentist)}
                    </td>
                    <td>
                      <span className={`badge ${APPOINTMENT_STATUS_BADGE[appt.status]}`}>
                        {appt.status.toLowerCase()}
                      </span>
                    </td>
                    <td>{appt.treatment?.procedure || '—'}</td>
                    <td>{appt.treatment ? `$${appt.treatment.amount.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Files ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Files
            {files.length > 0 && (
              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-hint)', marginLeft: '8px' }}>
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <FileUpload patientId={id} onUploaded={fetchFiles} />
        </div>

        {confirmDelete && (
          <div className="card" style={{
            marginBottom: '12px', padding: '14px 16px',
            border: '1px solid var(--danger-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              Delete <strong>{files.find(f => f.id === confirmDelete)?.fileName}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteFile(confirmDelete)}>
                Delete
              </button>
              <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loadingFiles ? (
          <div className="loading" style={{ padding: '24px 0' }}>Loading files...</div>
        ) : files.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-files" aria-hidden="true" />
              <div className="empty-title">No files</div>
              <div className="empty-subtitle">Upload X-rays, consent forms, or referral letters</div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i
                          className={`ti ${FILE_ICON[file.fileType] ?? 'ti-file'}`}
                          style={{ fontSize: '18px', color: 'var(--text-secondary)', flexShrink: 0 }}
                          aria-hidden="true"
                        />
                        <span style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-all' }}>
                          {file.fileName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-pending" style={{ fontSize: '11px' }}>
                        {file.fileType}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatDate(file.createdAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDownload(file)}
                          disabled={downloading === file.id}
                          aria-label="Download file"
                        >
                          <i className="ti ti-download" />
                          {downloading === file.id ? ' …' : ''}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setConfirmDelete(file.id)}
                          disabled={deleting === file.id || !!confirmDelete}
                          aria-label="Delete file"
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </td>
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