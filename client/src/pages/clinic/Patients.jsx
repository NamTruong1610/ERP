import { useState, useEffect, useRef, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllPatients, createPatient } from '../../api/clinic'
import AppSidebar from '../../components/AppSidebar'
import './clinic.css'

// ─── Create Patient Modal ──────────────────────────────────────────────────────
const initialForm = {
  firstName: '', lastName: '', dob: '', gender: '',
  phone: '', email: '', address: ''
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

function CreatePatientModal({ onClose, onCreated }) {
  const [form, dispatch] = useReducer(formReducer, initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const firstInputRef = useRef(null)

  // Auto-focus first field when modal opens
  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const handleChange = (e) => {
    dispatch({ type: 'setField', field: e.target.name, value: e.target.value })
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
        <div className="modal-title">Register new patient</div>
        <form onSubmit={handleSubmit} className="clinic-form">
          <div className="form-row">
            <div className="form-group">
              <label>First name *</label>
              <input
                ref={firstInputRef}
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="John"
                required
              />
            </div>
            <div className="form-group">
              <label>Last name *</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date of birth *</label>
              <input
                name="dob"
                type="date"
                value={form.dob}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Gender *</label>
              <select name="gender" value={form.gender} onChange={handleChange} required>
                <option value="">Select gender</option>
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
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="0412 345 678"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john@example.com"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="123 Main St, Sydney"
            />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Patients List Page ────────────────────────────────────────────────────────
export default function Patients() {
  const navigate = useNavigate()
  const searchRef = useRef(null)

  const [patients, setPatients] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchPatients = async () => {
    try {
      const data = await getAllPatients()
      setPatients(data.patients)
      setFiltered(data.patients)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => { await fetchPatients() }
    load()
    // Auto-focus search bar on mount
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      patients.filter(p =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q)
      )
    )
  }, [search, patients])

  const formatDate = (d) => new Date(d).toLocaleDateString()

  return (
    <div className="clinic-layout">
      <AppSidebar active="patients" />

      <main className="clinic-main">
        <div className="clinic-page-header">
          <div>
            <div className="clinic-page-title">Patients</div>
            <div className="clinic-page-subtitle">{patients.length} total patients</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              ref={searchRef}
              className="search-bar"
              placeholder="Search by name, email, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New patient
            </button>
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="clinic-loading">Loading patients...</div>
        ) : filtered.length === 0 ? (
          <div className="clinic-empty">No patients found</div>
        ) : (
          <div className="clinic-table-wrap">
            <table className="clinic-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date of birth</th>
                  <th>Gender</th>
                  <th>Phone</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(patient => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate(`/clinic/patients/${patient.id}`)}
                  >
                    <td>{patient.firstName} {patient.lastName}</td>
                    <td>{formatDate(patient.dob)}</td>
                    <td>{patient.gender}</td>
                    <td>{patient.phone || '—'}</td>
                    <td>{patient.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showCreate && (
          <CreatePatientModal
            onClose={() => setShowCreate(false)}
            onCreated={fetchPatients}
          />
        )}
      </main>
    </div>
  )
}