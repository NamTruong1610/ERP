import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getTreatmentPlan, addTreatmentPlanItemsBulk,
  updateTreatmentPlanItem, deleteTreatmentPlanItem, attachTreatmentsToTreatmentPlan, updateTreatmentPlan
} from '../../api/treatmentPlan'
import { getAllProcedures } from '../../api/procedureCatalog'
import { getAllTreatmentsByPatient, updateTreatment } from '../../api/clinic'
import AppSidebar from '../../components/layout/AppSidebar'
import { formatDate } from '../../lib/format'
import { TREATMENT_PLAN_STATUS_BADGE, PLAN_ITEM_STATUS_BADGE } from '../../lib/labels'
import '../../styles/global.css'

const formatMoney = (n) => `$${Number(n).toFixed(2)}`

const emptyRow = { procedureCatalogId: '', procedure: '', toothNumber: '', estimatedAmount: '' }
function rowsReducer(state, action) {
  switch (action.type) {
    case 'setRow': {
      const rows = [...state]
      rows[action.index] = { ...rows[action.index], [action.field]: action.value }
      return rows
    }
    case 'addRow': return [...state, { ...emptyRow }]
    case 'removeRow': return state.filter((_, i) => i !== action.index)
    case 'reset': return [{ ...emptyRow }]
    default: return state
  }
}

function editReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'init': return action.payload
    default: return state
  }
}

export default function TreatmentPlanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  // Bulk add items
  const [showAddItems, setShowAddItems] = useState(false)
  const [itemRows, dispatchRows] = useReducer(rowsReducer, [{ ...emptyRow }])
  const [addItemsError, setAddItemsError] = useState('')
  const [addItemsLoading, setAddItemsLoading] = useState(false)

  // Edit a single item
  const [editingItemId, setEditingItemId] = useState(null)
  const [editForm, dispatchEdit] = useReducer(editReducer, emptyRow)
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState(null)

  // Attach existing treatment
  const [showAttach, setShowAttach] = useState(false)
  const [attachable, setAttachable] = useState([])
  const [loadingAttachable, setLoadingAttachable] = useState(false)
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState(new Set())
  const [attachError, setAttachError] = useState('')
  const [attachLoading, setAttachLoading] = useState(false)

  const [detachingId, setDetachingId] = useState(null)

  const [procedures, setProcedures] = useState([])

  const [showEditPlan, setShowEditPlan] = useState(false)
  const [planForm, dispatchPlanForm] = useReducer(editReducer, { title: '', notes: '' })
  const [planEditError, setPlanEditError] = useState('')
  const [planEditLoading, setPlanEditLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  const fetchPlan = async () => {
    try {
      const data = await getTreatmentPlan(id)
      setPlan(data.treatmentPlan)
    } catch {
      setError('Failed to load treatment plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPlan() }, [id])

  // ── Bulk add items ──────────────────────────────────────────────────────
  const openAddItems = async () => {
    if (!procedures.length) {
      try {
        const data = await getAllProcedures({ active: 'true', take: 100 })
        setProcedures(data.procedures)
      } catch {
        // non-fatal
      }
    }
    dispatchRows({ type: 'reset' })
    setAddItemsError('')
    setShowAddItems(true)
  }

  const handlePickRowProcedure = (index, procedureId) => {
    const p = procedures.find(pr => pr.id === procedureId)
    if (!p) {
      dispatchRows({ type: 'setRow', index, field: 'procedureCatalogId', value: '' })
      return
    }
    dispatchRows({ type: 'setRow', index, field: 'procedureCatalogId', value: p.id })
    dispatchRows({ type: 'setRow', index, field: 'procedure', value: p.name })
    dispatchRows({ type: 'setRow', index, field: 'estimatedAmount', value: p.defaultAmount.toString() })
  }

  const handleAddItemsSubmit = async (e) => {
    e.preventDefault()
    setAddItemsLoading(true)
    setAddItemsError('')
    try {
      const items = itemRows.map(r => ({
        procedureCatalogId: r.procedureCatalogId || undefined,
        procedure: r.procedure,
        toothNumber: r.toothNumber ? parseInt(r.toothNumber) : null,
        estimatedAmount: parseFloat(r.estimatedAmount)
      }))
      await addTreatmentPlanItemsBulk(id, items)
      setFeedback('Items added')
      setShowAddItems(false)
      await fetchPlan()
    } catch (err) {
      setAddItemsError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setAddItemsLoading(false)
    }
  }

  // ── Edit / delete a single item ─────────────────────────────────────────
  const startEditItem = (item) => {
    setEditingItemId(item.id)
    dispatchEdit({
      type: 'init',
      payload: {
        procedure: item.procedure,
        toothNumber: item.toothNumber?.toString() || '',
        estimatedAmount: item.estimatedAmount.toString()
      }
    })
    setEditError('')
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      await updateTreatmentPlanItem(id, editingItemId, {
        procedure: editForm.procedure,
        toothNumber: editForm.toothNumber ? parseInt(editForm.toothNumber) : null,
        estimatedAmount: parseFloat(editForm.estimatedAmount)
      })
      setFeedback('Item updated')
      setEditingItemId(null)
      await fetchPlan()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Remove this item from the plan?')) return
    setDeletingItemId(itemId)
    setError('')
    try {
      await deleteTreatmentPlanItem(id, itemId)
      setFeedback('Item removed')
      await fetchPlan()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setDeletingItemId(null)
    }
  }

  // ── Attach existing treatment ───────────────────────────────────────────
  const openAttach = async () => {
    setShowAttach(true)
    setSelectedTreatmentIds(new Set())
    setAttachError('')
    setLoadingAttachable(true)
    try {
      const data = await getAllTreatmentsByPatient(plan.patientId)
      setAttachable(data.treatments.filter(t => !t.treatmentPlanId))
    } catch {
      setAttachError('Failed to load treatments')
    } finally {
      setLoadingAttachable(false)
    }
  }

  const toggleTreatment = (tid) => {
    setSelectedTreatmentIds(prev => {
      const next = new Set(prev)
      next.has(tid) ? next.delete(tid) : next.add(tid)
      return next
    })
  }

  const handleAttachSubmit = async (e) => {
    e.preventDefault()
    if (selectedTreatmentIds.size === 0) {
      setAttachError('Select at least one treatment')
      return
    }
    setAttachLoading(true)
    setAttachError('')
    try {
      await attachTreatmentsToTreatmentPlan(id, [...selectedTreatmentIds])
      setFeedback('Treatments attached')
      setShowAttach(false)
      await fetchPlan()
    } catch (err) {
      setAttachError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setAttachLoading(false)
    }
  }

  const handleDetachTreatment = async (treatmentId) => {
    if (!window.confirm('Remove this treatment from the plan? The treatment record itself will not be deleted.')) return
    setDetachingId(treatmentId)
    setError('')
    try {
      await updateTreatment(treatmentId, { treatmentPlanId: null })
      setFeedback('Treatment removed from plan')
      await fetchPlan()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setDetachingId(null)
    }
  }

  const startEditPlan = () => {
    dispatchPlanForm({ type: 'init', payload: { title: plan.title, notes: plan.notes || '' } })
    setPlanEditError('')
    setShowEditPlan(true)
  }

  const handlePlanEditSubmit = async (e) => {
    e.preventDefault()
    setPlanEditLoading(true)
    setPlanEditError('')
    try {
      await updateTreatmentPlan(id, {
        title: planForm.title,
        notes: planForm.notes
      })
      setFeedback('Treatment plan updated')
      setShowEditPlan(false)
      await fetchPlan()
    } catch (err) {
      setPlanEditError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setPlanEditLoading(false)
    }
  }

  const handleStatusChange = async (status) => {
    const confirmMessage = status === 'CANCELLED'
      ? 'Cancel this treatment plan? Any proposed items will also be cancelled.'
      : status === 'COMPLETED'
        ? 'Mark this treatment plan as completed?'
        : null
    if (confirmMessage && !window.confirm(confirmMessage)) return

    setStatusLoading(true)
    setError('')
    setFeedback('')
    try {
      await updateTreatmentPlan(id, { status })
      setFeedback(`Plan ${status === 'ACTIVE' ? 'activated' : status.toLowerCase()}`)
      await fetchPlan()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status')
    } finally {
      setStatusLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading treatment plan...</div>
  if (!plan) return <div className="loading">{error || 'Treatment plan not found'}</div>

  const isClosed = plan.status === 'COMPLETED' || plan.status === 'CANCELLED'
  const estimatedTotal = (plan.treatmentPlanItems || []).reduce((sum, i) => sum + i.estimatedAmount, 0)
  const actualTotal = (plan.treatments || []).reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="app-layout">
      <AppSidebar active="treatment-plans" />
      <main className="main">
        <Link to="/clinic/treatment-plans" className="back-link">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to treatment plans
        </Link>

        <div className="page-header">
          <div>
            <div className="page-title">{plan.title}</div>
            <div className="page-subtitle">
              <span style={{ color: 'var(--primary)', cursor: 'pointer' }}
                onClick={() => navigate(`/clinic/patients/${plan.patientId}`)}>
                {plan.patient?.firstName} {plan.patient?.lastName}
              </span>
              {' · '}Created {formatDate(plan.createdAt)}
              {plan.createdBy && ` by ${plan.createdBy.name?.fName ? `${plan.createdBy.name.fName} ${plan.createdBy.name.lName}` : plan.createdBy.email}`}
            </div>
          </div>
          <span className={`badge ${TREATMENT_PLAN_STATUS_BADGE[plan.status]}`}>
            {plan.status.toLowerCase()}
          </span>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {plan.notes && (
          <div className="detail-grid">
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
              <div className="detail-label">Notes</div>
              <div className="detail-value">{plan.notes}</div>
            </div>
          </div>
        )}

        {isClosed ? (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div className="empty" style={{ padding: '12px 0' }}>
              <div className="empty-subtitle">This plan is {plan.status.toLowerCase()}.</div>
            </div>
            <button className="btn" style={{ marginTop: '8px' }} onClick={startEditPlan}>
              <i className="ti ti-edit" aria-hidden="true" /> Edit title / notes
            </button>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn" onClick={startEditPlan}>
                <i className="ti ti-edit" aria-hidden="true" /> Edit title / notes
              </button>
              {plan.status === 'PROPOSED' && (
                <button className="btn" disabled={statusLoading} onClick={() => handleStatusChange('ACTIVE')}>
                  {statusLoading ? 'Updating...' : 'Mark active'}
                </button>
              )}
              <button className="btn" disabled={statusLoading} onClick={() => handleStatusChange('COMPLETED')}>
                {statusLoading ? 'Updating...' : (<><i className="ti ti-check" aria-hidden="true" /> Complete plan</>)}
              </button>
              <button className="btn btn-danger" disabled={statusLoading} onClick={() => handleStatusChange('CANCELLED')}>
                {statusLoading ? 'Updating...' : (<><i className="ti ti-x" aria-hidden="true" /> Cancel plan</>)}
              </button>
            </div>
          </div>
        )}

        {showEditPlan && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Edit treatment plan</div>
            <form onSubmit={handlePlanEditSubmit} className="form">
              <div className="form-group">
                <label className="form-label">Title <span>*</span></label>
                <input className="form-input" value={planForm.title}
                  onChange={e => dispatchPlanForm({ type: 'set', field: 'title', value: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={planForm.notes}
                  onChange={e => dispatchPlanForm({ type: 'set', field: 'notes', value: e.target.value })} />
              </div>
              {planEditError && <div className="feedback-error">{planEditError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowEditPlan(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={planEditLoading}>
                  {planEditLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label"><i className="ti ti-file-invoice" aria-hidden="true" /> Estimated total</div>
            <div className="stat-value">{formatMoney(estimatedTotal)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><i className="ti ti-check" aria-hidden="true" /> Actual total</div>
            <div className="stat-value">{formatMoney(actualTotal)}</div>
          </div>
        </div>

        {/* Proposed items */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Proposed items ({plan.treatmentPlanItems?.length || 0})</div>
            {!isClosed && (
              <button className="btn btn-sm btn-primary" onClick={openAddItems}>
                <i className="ti ti-plus" aria-hidden="true" /> Add items
              </button>
            )}
          </div>

          {!plan.treatmentPlanItems?.length ? (
            <div className="empty" style={{ padding: '24px 0' }}>
              <div className="empty-subtitle">No proposed items yet</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Procedure</th>
                    <th>Tooth</th>
                    <th>Estimated</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {plan.treatmentPlanItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.procedure}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.toothNumber || '—'}</td>
                      <td>{formatMoney(item.estimatedAmount)}</td>
                      <td>
                        <span className={`badge ${PLAN_ITEM_STATUS_BADGE[item.status]}`}>
                          {item.status.toLowerCase()}
                        </span>
                      </td>
                      <td>
                        {item.status !== 'COMPLETED' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-sm" onClick={() => startEditItem(item)}>
                              <i className="ti ti-edit" aria-hidden="true" />
                            </button>
                            <button className="btn btn-sm btn-danger" disabled={deletingItemId === item.id}
                              onClick={() => handleDeleteItem(item.id)}>
                              <i className="ti ti-trash" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editingItemId && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Edit item</div>
            <form onSubmit={handleEditSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Procedure <span>*</span></label>
                  <input className="form-input" value={editForm.procedure}
                    onChange={e => dispatchEdit({ type: 'set', field: 'procedure', value: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tooth number</label>
                  <input type="number" min="1" max="32" className="form-input" value={editForm.toothNumber}
                    onChange={e => dispatchEdit({ type: 'set', field: 'toothNumber', value: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Estimated cost (AUD) <span>*</span></label>
                <input type="number" min="0" step="0.01" className="form-input" value={editForm.estimatedAmount}
                  onChange={e => dispatchEdit({ type: 'set', field: 'estimatedAmount', value: e.target.value })} required />
              </div>
              {editError && <div className="feedback-error">{editError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setEditingItemId(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {showAddItems && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Add proposed items</div>
            <form onSubmit={handleAddItemsSubmit} className="form">
              {itemRows.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    {i === 0 && <label className="form-label">Catalog</label>}
                    <select className="form-select" value={row.procedureCatalogId}
                      onChange={e => handlePickRowProcedure(i, e.target.value)}>
                      <option value="">Manual</option>
                      {procedures.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    {i === 0 && <label className="form-label">Procedure <span>*</span></label>}
                    <input className="form-input" value={row.procedure}
                      onChange={e => dispatchRows({ type: 'setRow', index: i, field: 'procedure', value: e.target.value })}
                      placeholder="e.g. Filling" required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    {i === 0 && <label className="form-label">Tooth</label>}
                    <input type="number" min="1" max="32" className="form-input" value={row.toothNumber}
                      onChange={e => dispatchRows({ type: 'setRow', index: i, field: 'toothNumber', value: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    {i === 0 && <label className="form-label">Estimated <span>*</span></label>}
                    <input type="number" min="0" step="0.01" className="form-input" value={row.estimatedAmount}
                      onChange={e => dispatchRows({ type: 'setRow', index: i, field: 'estimatedAmount', value: e.target.value })}
                      placeholder="0.00" required />
                  </div>
                  {itemRows.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatchRows({ type: 'removeRow', index: i })}>
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}
                onClick={() => dispatchRows({ type: 'addRow' })}>
                <i className="ti ti-plus" aria-hidden="true" /> Add another line
              </button>
              {addItemsError && <div className="feedback-error">{addItemsError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowAddItems(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addItemsLoading}>
                  {addItemsLoading ? 'Adding...' : 'Add items'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Attached treatments */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Treatments ({plan.treatments?.length || 0})</div>
            {!isClosed && (
              <button className="btn btn-sm" onClick={openAttach}>
                <i className="ti ti-link" aria-hidden="true" /> Attach treatment
              </button>
            )}
          </div>

          {!plan.treatments?.length ? (
            <div className="empty" style={{ padding: '24px 0' }}>
              <div className="empty-subtitle">No treatments attached yet</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Procedure</th>
                    <th>Tooth</th>
                    <th>Cost</th>
                    <th>Recorded</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.treatments.map(t => (
                    <tr key={t.id}>
                      <td>{t.procedure}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.toothNumber || '—'}</td>
                      <td>{formatMoney(t.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDate(t.createdAt)}</td>
                      <td>
                        {!isClosed ? (
                          <button className="btn btn-sm btn-danger" disabled={detachingId === t.id}
                            onClick={() => handleDetachTreatment(t.id)}>
                            {detachingId === t.id ? '...' : 'Detach'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-hint)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAttach && (
          <div className="modal-overlay" onClick={() => setShowAttach(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Attach treatments</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAttach(false)} aria-label="Close">
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleAttachSubmit} className="form">
                {loadingAttachable ? (
                  <div className="loading" style={{ minHeight: '100px' }}>Loading treatments...</div>
                ) : attachable.length === 0 ? (
                  <div className="empty" style={{ padding: '24px 0' }}>
                    <div className="empty-subtitle">No unattached treatments found for this patient</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <tbody>
                        {attachable.map(t => (
                          <tr key={t.id} onClick={() => toggleTreatment(t.id)} style={{ cursor: 'pointer' }}>
                            <td style={{ width: '32px' }}>
                              <input type="checkbox" checked={selectedTreatmentIds.has(t.id)} readOnly />
                            </td>
                            <td>{t.procedure}{t.toothNumber ? ` (tooth ${t.toothNumber})` : ''}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{formatMoney(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {attachError && <div className="feedback-error">{attachError}</div>}
                <div className="form-actions">
                  <button type="button" className="btn" onClick={() => setShowAttach(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={attachLoading || attachable.length === 0}>
                    {attachLoading ? 'Attaching...' : 'Attach selected'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}