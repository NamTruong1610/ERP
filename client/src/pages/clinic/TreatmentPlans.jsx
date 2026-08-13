import { useState, useEffect, useReducer, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllTreatmentPlans, createTreatmentPlan } from '../../api/treatmentPlan'
import { getAllPatients } from '../../api/clinic'
import AppSidebar from '../../components/layout/AppSidebar'
import Pagination from '../../components/ui/Pagination'
import { formatDate } from '../../lib/format'
import { TREATMENT_PLAN_STATUS_BADGE } from '../../lib/labels'
import '../../styles/global.css'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PROPOSED', label: 'Proposed' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PAGE_SIZE = 20

// ── CreateTreatmentPlanModal ─────────────────────────────────────────────────

const initialForm = { title: '', notes: '' }

function formReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    default: return state
  }
}

function CreateTreatmentPlanModal({ onClose, onCreated }) {
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)

  const [form, dispatch] = useReducer(formReducer, initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => { if (selectedPatient) titleRef.current?.focus() }, [selectedPatient])

  const handlePatientSearch = async (e) => {
    e.preventDefault()
    if (!patientQuery.trim()) return
    setSearchingPatients(true)
    setError('')
    try {
      const data = await getAllPatients({ search: patientQuery.trim(), take: 10 })
      setPatientResults(data.patients)
    } catch {
      setError('Failed to search patients')
    } finally {
      setSearchingPatients(false)
    }
  }

  const handleChange = (e) => {
    dispatch({ type: 'set', field: e.target.name, value: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await createTreatmentPlan({
        patientId: selectedPatient.id,
        title: form.title.trim(),
        notes: form.notes.trim() || undefined
      })
      onCreated(data.treatmentPlan)
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
          <div className="modal-title">New treatment plan</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>

        {!selectedPatient ? (
          <>
            <form onSubmit={handlePatientSearch} className="form">
              <div className="form-group">
                <label className="form-label">Find patient <span>*</span></label>
                <div className="search-wrap">
                  <i className="ti ti-search" aria-hidden="true" />
                  <input
                    className="search-input"
                    style={{ width: '100%' }}
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                    placeholder="Search by name..."
                    autoFocus
                  />
                </div>
              </div>
              {error && <div className="feedback-error">{error}</div>}
            </form>
            {searchingPatients && <div className="loading" style={{ minHeight: '80px' }}>Searching...</div>}
            {!searchingPatients && patientResults.length > 0 && (
              <div className="table-wrap" style={{ marginTop: '12px' }}>
                <table className="table">
                  <tbody>
                    {patientResults.map(p => (
                      <tr key={p.id} onClick={() => setSelectedPatient(p)}>
                        <td>
                          <div className="avatar-cell">
                            <div className="avatar">{`${p.firstName[0]}${p.lastName[0]}`.toUpperCase()}</div>
                            {p.firstName} {p.lastName}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} className="form">
            <div className="user-info">
              <div className="avatar">{`${selectedPatient.firstName[0]}${selectedPatient.lastName[0]}`.toUpperCase()}</div>
              <div>
                <div className="user-info-name">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                <div className="user-info-role">Patient</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                onClick={() => setSelectedPatient(null)}>Change</button>
            </div>
            <div className="form-group">
              <label className="form-label">Title <span>*</span></label>
              <input name="title" className="form-input" value={form.title} onChange={handleChange}
                placeholder="e.g. Lower left molar — extraction & restoration" required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea name="notes" className="form-textarea" value={form.notes} onChange={handleChange}
                placeholder="Any context for this case..." />
            </div>
            {error && <div className="feedback-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create plan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── TreatmentPlans page ──────────────────────────────────────────────────────

export default function TreatmentPlans() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get('status') || ''
  const patientId = searchParams.get('patientId') || ''
  const skip = parseInt(searchParams.get('skip') || '0')
  const take = parseInt(searchParams.get('take') || String(PAGE_SIZE))

  const [plans, setPlans] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const data = await getAllTreatmentPlans({
        take, skip,
        status: status || undefined,
        patientId: patientId || undefined
      })
      setPlans(data.treatmentPlans)
      setTotal(data.total)
    } catch {
      setError('Failed to load treatment plans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPlans() }, [searchParams])

  const handleStatusChange = (value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set('status', value)
      else next.delete('status')
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

  const hasActiveFilters = status || patientId

  return (
    <div className="app-layout">
      <AppSidebar active="treatment-plans" />
      <main className="main">

        <div className="page-header">
          <div>
            <div className="page-title">Treatment plans</div>
            <div className="page-subtitle">{total} total plans</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> New treatment plan
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Status
            </label>
            <select className="form-select" value={status} onChange={e => handleStatusChange(e.target.value)} style={{ width: 'auto' }}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {hasActiveFilters && (
            <button className="btn btn-sm btn-ghost" onClick={() => setSearchParams({})}
              style={{ color: 'var(--text-hint)', fontSize: '12px' }}>
              <i className="ti ti-x" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="loading">Loading treatment plans...</div>
        ) : plans.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-clipboard-list" aria-hidden="true" />
              <div className="empty-title">No treatment plans found</div>
              <div className="empty-subtitle">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Create a plan to track a multi-visit case'}
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => (
                  <tr key={plan.id} onClick={() => navigate(`/clinic/treatment-plans/${plan.id}`)}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar">
                          {`${plan.patient?.firstName?.[0] ?? ''}${plan.patient?.lastName?.[0] ?? ''}`.toUpperCase()}
                        </div>
                        {plan.patient?.firstName} {plan.patient?.lastName}
                      </div>
                    </td>
                    <td>{plan.title}</td>
                    <td>
                      <span className={`badge ${TREATMENT_PLAN_STATUS_BADGE[plan.status]}`}>
                        {plan.status.toLowerCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {(plan.treatmentPlanItems?.length ?? 0) + (plan.treatments?.length ?? 0)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(plan.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination skip={skip} take={take} total={total} onPageChange={handlePageChange} />
          </div>
        )}

        {showCreate && (
          <CreateTreatmentPlanModal
            onClose={() => setShowCreate(false)}
            onCreated={(plan) => navigate(`/clinic/treatment-plans/${plan.id}`)}
          />
        )}
      </main>
    </div>
  )
}