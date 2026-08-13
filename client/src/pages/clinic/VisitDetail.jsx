import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getVisit, updateVisit, addVisitProvider, editVisitProviderRole, removeVisitProvider } from '../../api/visit'
import { createTreatment, updateTreatment } from '../../api/clinic'
import { getAllProcedures } from '../../api/procedureCatalog'
import { getDentists } from '../../api/user'
import AppSidebar from '../../components/layout/AppSidebar'
import { formatDateTime } from '../../lib/format'
import '../../styles/global.css'

const initialTreatment = { procedureCatalogId: '', procedure: '', toothNumber: '', notes: '', amount: '' }

function reducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'init': return action.payload
    default: return state
  }
}

export default function VisitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [completingVisit, setCompletingVisit] = useState(false)
  const [cancellingVisit, setCancellingVisit] = useState(false)

  const [showTreatment, setShowTreatment] = useState(false)
  const [editingTreatmentId, setEditingTreatmentId] = useState(null)
  const [treatmentForm, dispatchTreatment] = useReducer(reducer, initialTreatment)
  const [treatmentError, setTreatmentError] = useState('')
  const [treatmentLoading, setTreatmentLoading] = useState(false)

  const [procedures, setProcedures] = useState([])

  const [showAddProvider, setShowAddProvider] = useState(false)
  const [staff, setStaff] = useState([])
  const [providerForm, dispatchProvider] = useReducer(reducer, { performerId: '', role: 'PRIMARY' })
  const [addProviderError, setAddProviderError] = useState('')
  const [addProviderLoading, setAddProviderLoading] = useState(false)
  const [editingProviderId, setEditingProviderId] = useState(null)
  const [editingProviderLoading, setEditingProviderLoading] = useState(null)
  const [removingProviderId, setRemovingProviderId] = useState(null)

  const fetchVisit = async () => {
    try {
      const data = await getVisit(id)
      setVisit(data.visit)
    } catch {
      setError('Failed to load visit')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVisit() }, [id])

  const handleCompleteVisit = async () => {
    setCompletingVisit(true)
    setError('')
    setFeedback('')
    try {
      await updateVisit(id, { status: 'COMPLETED' })
      setFeedback('Visit completed')
      await fetchVisit()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete visit')
    } finally {
      setCompletingVisit(false)
    }
  }

  const handleCancelVisit = async () => {
    if (!window.confirm('Cancel this visit? This cannot be undone.')) return
    setCancellingVisit(true)
    setError('')
    setFeedback('')
    try {
      await updateVisit(id, { status: 'CANCELLED' })
      setFeedback('Visit cancelled')
      await fetchVisit()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel visit')
    } finally {
      setCancellingVisit(false)
    }
  }

  const openNewTreatment = async () => {
    if (!procedures.length) {
      try {
        const data = await getAllProcedures({ active: 'true', take: 100 })
        setProcedures(data.procedures)
      } catch {
        // Non-fatal — the picker just won't populate; manual entry still works
      }
    }
    setEditingTreatmentId(null)
    dispatchTreatment({ type: 'init', payload: initialTreatment })
    setShowTreatment(true)
  }

  const handlePickProcedure = (procedureId) => {
    const p = procedures.find(pr => pr.id === procedureId)
    if (!p) {
      dispatchTreatment({ type: 'set', field: 'procedureCatalogId', value: '' })
      return
    }
    dispatchTreatment({
      type: 'init', payload: {
        ...treatmentForm,
        procedureCatalogId: p.id,
        procedure: p.name,
        amount: p.defaultAmount.toString()
      }
    })
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
          visitId: id,  // or `id` directly in VisitDetail.jsx
          procedureCatalogId: treatmentForm.procedureCatalogId || undefined,
          procedure: treatmentForm.procedure,
          toothNumber: treatmentForm.toothNumber ? parseInt(treatmentForm.toothNumber) : null,
          notes: treatmentForm.notes,
          amount: parseFloat(treatmentForm.amount)
        })
        setFeedback('Treatment recorded')
      }
      await fetchVisit()
      setShowTreatment(false)
    } catch (err) {
      setTreatmentError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setTreatmentLoading(false)
    }
  }

  const openAddProvider = async () => {
    if (!staff.length) {
      try {
        const data = await getDentists()
        setStaff(data.dentists)
      } catch {
        setAddProviderError('Failed to load staff')
      }
    }
    dispatchProvider({ type: 'init', payload: { performerId: '', role: 'PRIMARY' } })
    setAddProviderError('')
    setShowAddProvider(true)
  }

  const handleAddProviderSubmit = async (e) => {
    e.preventDefault()
    if (!providerForm.performerId) {
      setAddProviderError('Select a staff member')
      return
    }
    setAddProviderLoading(true)
    setAddProviderError('')
    try {
      await addVisitProvider(id, providerForm)
      setFeedback('Provider added')
      setShowAddProvider(false)
      await fetchVisit()
    } catch (err) {
      setAddProviderError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setAddProviderLoading(false)
    }
  }

  const handleEditProviderRole = async (providerId, role) => {
    setEditingProviderLoading(providerId)
    setError('')
    try {
      await editVisitProviderRole(id, providerId, role)
      setFeedback('Provider role updated')
      setEditingProviderId(null)
      await fetchVisit()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEditingProviderLoading(null)
    }
  }

  const handleRemoveProvider = async (providerId) => {
    if (!window.confirm('Remove this provider from the visit?')) return
    setRemovingProviderId(providerId)
    setError('')
    try {
      await removeVisitProvider(id, providerId)
      setFeedback('Provider removed')
      await fetchVisit()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setRemovingProviderId(null)
    }
  }

  if (loading) return <div className="loading">Loading visit...</div>
  if (!visit) return <div className="loading">{error || 'Visit not found'}</div>

  const visitClosed = visit.status === 'COMPLETED' || visit.status === 'CANCELLED'

  return (
    <div className="app-layout">
      <AppSidebar active="patients" />
      <main className="main">
        <Link to={`/clinic/patients/${visit.patient.id}`} className="back-link">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to {visit.patient.firstName} {visit.patient.lastName}
        </Link>

        <div className="page-header">
          <div>
            <div className="page-title">Walk-in visit</div>
            <div className="page-subtitle">{formatDateTime(visit.visitDate)}</div>
          </div>
          <span className={`badge ${visit.status === 'COMPLETED' ? 'badge-completed' : visit.status === 'CANCELLED' ? 'badge-cancelled' : 'badge-scheduled'}`}>
            {visit.status.toLowerCase()}
          </span>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        <div className="detail-grid">
          <div className="detail-item" style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/clinic/patients/${visit.patient.id}`)}>
            <div className="detail-label">Patient</div>
            <div className="detail-value" style={{ color: 'var(--primary)' }}>
              {visit.patient.firstName} {visit.patient.lastName}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Appointment</div>
            <div className="detail-value">
              {visit.appointment
                ? <span style={{ color: 'var(--primary)', cursor: 'pointer' }}
                  onClick={() => navigate(`/clinic/appointments/${visit.appointment.id}`)}>
                  {formatDateTime(visit.appointment.date)}
                </span>
                : <span style={{ color: 'var(--text-hint)' }}>None — walk-in</span>}
            </div>
          </div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
            <div className="detail-label">Notes</div>
            <div className="detail-value">{visit.notes || '—'}</div>
          </div>
        </div>

        {visitClosed ? (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div className="empty" style={{ padding: '12px 0' }}>
              <div className="empty-subtitle">This visit is {visit.status.toLowerCase()} and can no longer be edited.</div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={openNewTreatment}>
                <i className="ti ti-plus" aria-hidden="true" /> Add treatment
              </button>
              <button className="btn" disabled={completingVisit} onClick={handleCompleteVisit}>
                {completingVisit ? 'Completing...' : (<><i className="ti ti-check" aria-hidden="true" /> Complete visit</>)}
              </button>
              <button className="btn btn-danger" disabled={cancellingVisit} onClick={handleCancelVisit}>
                {cancellingVisit ? 'Cancelling...' : (<><i className="ti ti-x" aria-hidden="true" /> Cancel visit</>)}
              </button>
            </div>
          </div>
        )}

        {showTreatment && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">{editingTreatmentId ? 'Edit treatment' : 'Record treatment'}</div>
            <form onSubmit={handleTreatmentSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quick-fill from catalog</label>
                  <select className="form-select" value={treatmentForm.procedureCatalogId}
                    onChange={e => handlePickProcedure(e.target.value)}>
                    <option value="">— Type manually —</option>
                    {procedures.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `${p.code} — ` : ''}{p.name} (${p.defaultAmount.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Procedure <span>*</span></label>
                  <input className="form-input" value={treatmentForm.procedure}
                    onChange={e => dispatchTreatment({ type: 'set', field: 'procedure', value: e.target.value })}
                    placeholder="e.g. Filling, Extraction, Cleaning" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tooth number (1–32)</label>
                  <input type="number" min="1" max="32" className="form-input" value={treatmentForm.toothNumber}
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
                <label className="form-label">Cost (AUD) <span>*</span></label>
                <input type="number" min="0" step="0.01" className="form-input" value={treatmentForm.amount}
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

        {visit.treatments.length > 0 && !showTreatment && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Treatments ({visit.treatments.length})</div>
            {visit.treatments.map((t, i) => (
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
                {i < visit.treatments.length - 1 && <div className="divider" />}
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Providers ({visit.visitProviders?.length || 0})</div>
            {!visitClosed && (
              <button className="btn btn-sm" onClick={openAddProvider}>
                <i className="ti ti-plus" aria-hidden="true" /> Add provider
              </button>
            )}
          </div>

          {!visit.visitProviders?.length ? (
            <div className="empty" style={{ padding: '24px 0' }}>
              <div className="empty-subtitle">No providers recorded for this visit</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visit.visitProviders.map(vp => (
                <div key={vp.id} className="user-info">
                  <div className="avatar">
                    {(vp.performer.name?.fName?.[0] ?? vp.performer.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="user-info-name">
                      {vp.performer.name?.fName ? `${vp.performer.name.fName} ${vp.performer.name.lName}` : vp.performer.email}
                    </div>
                    <div className="user-info-role">{vp.role.toLowerCase()}</div>
                  </div>
                  {!visitClosed && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                      {editingProviderId === vp.id ? (
                        <select className="form-select" defaultValue={vp.role} autoFocus
                          disabled={editingProviderLoading === vp.id}
                          onChange={e => handleEditProviderRole(vp.id, e.target.value)}
                          onBlur={() => setEditingProviderId(null)}>
                          <option value="PRIMARY">Primary</option>
                          <option value="ASSISTING">Assisting</option>
                          <option value="HYGIENIST">Hygienist</option>
                          <option value="OTHER">Other</option>
                        </select>
                      ) : (
                        <button className="btn btn-sm" onClick={() => setEditingProviderId(vp.id)}>
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" disabled={removingProviderId === vp.id}
                        onClick={() => handleRemoveProvider(vp.id)}>
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {showAddProvider && (
          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-title">Add provider</div>
            <form onSubmit={handleAddProviderSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Staff member <span>*</span></label>
                  <select className="form-select" value={providerForm.performerId}
                    onChange={e => dispatchProvider({ type: 'set', field: 'performerId', value: e.target.value })}>
                    <option value="">Select...</option>
                    {staff
                      .filter(s => !visit.visitProviders?.some(vp => vp.performerId === s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name ? `${s.name.fName} ${s.name.lName}` : s.email}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={providerForm.role}
                    onChange={e => dispatchProvider({ type: 'set', field: 'role', value: e.target.value })}>
                    <option value="PRIMARY">Primary</option>
                    <option value="ASSISTING">Assisting</option>
                    <option value="HYGIENIST">Hygienist</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              {addProviderError && <div className="feedback-error">{addProviderError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowAddProvider(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addProviderLoading}>
                  {addProviderLoading ? 'Adding...' : 'Add provider'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}