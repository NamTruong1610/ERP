import { useState, useEffect, useReducer } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getInvoice, updateInvoice, issueInvoice, voidInvoice, deleteInvoice,
  createInvoiceItem, updateInvoiceItem, deleteInvoiceItem,
  getUnbilledTreatments
} from '../../api/invoice'
import AppSidebar from '../../components/AppSidebar'
import '../../styles/global.css'

const STATUS_BADGE = {
  DRAFT: 'badge-pending',
  ISSUED: 'badge-completed',
  VOIDED: 'badge-danger'
}

const formatMoney = (n) => `$${Number(n).toFixed(2)}`
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU') : '—'
const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-AU') : '—'

function reducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'init': return action.payload
    default: return state
  }
}

const initialItemForm = { treatmentId: '', description: '', amount: '' }

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit invoice (billed-to / due date / notes)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, dispatchEdit] = useReducer(reducer, {})
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Item add/edit
  const [itemMode, setItemMode] = useState(null) // null | 'add' | itemId being edited
  const [itemForm, dispatchItem] = useReducer(reducer, initialItemForm)
  const [itemError, setItemError] = useState('')
  const [itemLoading, setItemLoading] = useState(false)
  const [unbilled, setUnbilled] = useState([])
  const [deletingItemId, setDeletingItemId] = useState(null)

  const fetchInvoice = async () => {
    try {
      const data = await getInvoice(id)
      setInvoice(data.invoice)
    } catch {
      setError('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvoice() }, [id])

  const isDraft = invoice?.status === 'DRAFT'
  const isVoided = invoice?.status === 'VOIDED'

  // ── Edit invoice details ──────────────────────────────────────────────────

  const startEdit = () => {
    dispatchEdit({
      type: 'init',
      payload: {
        dueAt: invoice.dueAt ? invoice.dueAt.split('T')[0] : '',
        notes: invoice.notes || '',
        billedToName: invoice.billedToName || '',
        billedToEmail: invoice.billedToEmail || '',
        billedToPhone: invoice.billedToPhone || '',
        billedToAddress: invoice.billedToAddress || '',
      }
    })
    setShowEdit(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      await updateInvoice(id, {
        dueAt: editForm.dueAt ? new Date(editForm.dueAt).toISOString() : null,
        notes: editForm.notes,
        billedToName: editForm.billedToName,
        billedToEmail: editForm.billedToEmail,
        billedToPhone: editForm.billedToPhone,
        billedToAddress: editForm.billedToAddress,
      })
      setFeedback('Invoice updated')
      setShowEdit(false)
      await fetchInvoice()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Issue ─────────────────────────────────────────────────────────────────

  const handleIssue = async () => {
    if (!window.confirm('Issue this invoice? Once issued it can no longer be edited.')) return
    setIssuing(true)
    setError('')
    try {
      await issueInvoice(id)
      setFeedback('Invoice issued')
      await fetchInvoice()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setIssuing(false)
    }
  }

  const handleVoid = async () => {
    const reason = window.prompt('Reason for voiding this invoice?')
    if (!reason || !reason.trim()) return
    setVoiding(true)
    setError('')
    try {
      await voidInvoice(id, reason.trim())
      setFeedback('Invoice voided')
      await fetchInvoice()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setVoiding(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this draft invoice? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    try {
      await deleteInvoice(id)
      navigate('/clinic/invoices')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  const startAddItem = async () => {
    dispatchItem({ type: 'init', payload: initialItemForm })
    setItemError('')
    setItemMode('add')
    try {
      const data = await getUnbilledTreatments(invoice.patientId)
      setUnbilled(data.treatments)
    } catch {
      setUnbilled([])
    }
  }

  const startEditItem = (item) => {
    dispatchItem({
      type: 'init',
      payload: {
        treatmentId: item.treatmentId || '',
        description: item.description,
        amount: item.amount.toString()
      }
    })
    setItemError('')
    setItemMode(item.id)
  }

  const handleItemSubmit = async (e) => {
    e.preventDefault()
    setItemLoading(true)
    setItemError('')
    try {
      const payload = itemForm.treatmentId
        ? { treatmentId: itemForm.treatmentId }
        : { description: itemForm.description, amount: itemForm.amount }

      if (itemMode === 'add') {
        const data = await createInvoiceItem(id, payload)
        setInvoice(data.invoice)
        setFeedback('Item added')
      } else {
        const data = await updateInvoiceItem(id, itemMode, payload)
        setInvoice(data.invoice)
        setFeedback('Item updated')
      }
      setItemMode(null)
    } catch (err) {
      setItemError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setItemLoading(false)
    }
  }

  const handleDeleteItem = async (itemId) => {
    setDeletingItemId(itemId)
    setError('')
    try {
      const data = await deleteInvoiceItem(id, itemId)
      setInvoice(data.invoice)
      setFeedback('Item removed')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setDeletingItemId(null)
    }
  }

  if (loading) return <div className="loading">Loading invoice...</div>
  if (!invoice) return <div className="loading">{error || 'Invoice not found'}</div>

  return (
    <div className="app-layout">
      <AppSidebar active="invoices" />
      <main className="main">
        <Link to="/clinic/invoices" className="back-link">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to invoices
        </Link>

        <div className="page-header">
          <div>
            <div className="page-title">{invoice.invoiceNumber || 'Draft invoice'}</div>
            <div className="page-subtitle">
              <span
                style={{ cursor: 'pointer', color: 'var(--primary)' }}
                onClick={() => navigate(`/clinic/patients/${invoice.patientId}`)}
              >
                {invoice.patient?.firstName} {invoice.patient?.lastName}
              </span>
            </div>
          </div>
          <span className={`badge ${STATUS_BADGE[invoice.status]}`}>
            {invoice.status.toLowerCase()}
          </span>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {/* Billing details */}
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Invoice #</div>
            <div className="detail-value">{invoice.invoiceNumber || 'Not yet issued'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Billed to</div>
            <div className="detail-value">{invoice.billedToName || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Email</div>
            <div className="detail-value">{invoice.billedToEmail || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Phone</div>
            <div className="detail-value">{invoice.billedToPhone || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Address</div>
            <div className="detail-value">{invoice.billedToAddress || '—'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Due date</div>
            <div className="detail-value">{formatDate(invoice.dueAt)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Issued</div>
            <div className="detail-value">{invoice.issuedAt ? formatDateTime(invoice.issuedAt) : '—'}</div>
          </div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
            <div className="detail-label">Notes</div>
            <div className="detail-value">{invoice.notes || '—'}</div>
          </div>
          {isVoided && (
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
              <div className="detail-label">Void reason</div>
              <div className="detail-value">{invoice.voidReason || '—'}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isVoided && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Actions</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isDraft && (
                <>
                  <button className="btn" onClick={startEdit}>
                    <i className="ti ti-edit" aria-hidden="true" /> Edit details
                  </button>
                  <button className="btn" onClick={startAddItem}>
                    <i className="ti ti-plus" aria-hidden="true" /> Add item
                  </button>
                  <button className="btn btn-primary" disabled={issuing || invoice.items.length === 0} onClick={handleIssue}>
                    {issuing ? 'Issuing...' : 'Issue invoice'}
                  </button>
                  <button className="btn btn-danger" disabled={deleting} onClick={handleDelete}>
                    {deleting ? 'Deleting...' : 'Delete invoice'}
                  </button>
                </>
              )}
              {invoice.status === 'ISSUED' && (
                <button className="btn btn-danger" disabled={voiding} onClick={handleVoid}>
                  {voiding ? 'Voiding...' : 'Void invoice'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Edit invoice form */}
        {showEdit && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">Edit invoice details</div>
            <form onSubmit={handleEditSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Billed-to name</label>
                  <input className="form-input" value={editForm.billedToName}
                    onChange={e => dispatchEdit({ type: 'set', field: 'billedToName', value: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Billed-to email</label>
                  <input type="email" className="form-input" value={editForm.billedToEmail}
                    onChange={e => dispatchEdit({ type: 'set', field: 'billedToEmail', value: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Billed-to phone</label>
                  <input className="form-input" value={editForm.billedToPhone}
                    onChange={e => dispatchEdit({ type: 'set', field: 'billedToPhone', value: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due date</label>
                  <input type="date" className="form-input" value={editForm.dueAt}
                    onChange={e => dispatchEdit({ type: 'set', field: 'dueAt', value: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Billed-to address</label>
                <input className="form-input" value={editForm.billedToAddress}
                  onChange={e => dispatchEdit({ type: 'set', field: 'billedToAddress', value: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={editForm.notes}
                  onChange={e => dispatchEdit({ type: 'set', field: 'notes', value: e.target.value })}
                  placeholder="Any notes for this invoice..." />
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

        {/* Add / edit item form */}
        {itemMode && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-title">{itemMode === 'add' ? 'Add item' : 'Edit item'}</div>
            <form onSubmit={handleItemSubmit} className="form">
              {itemMode === 'add' && (
                <div className="form-group">
                  <label className="form-label">Link to unbilled treatment (optional)</label>
                  <select
                    className="form-select"
                    value={itemForm.treatmentId}
                    onChange={e => dispatchItem({ type: 'set', field: 'treatmentId', value: e.target.value })}
                  >
                    <option value="">Custom line item</option>
                    {unbilled.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.procedure} — {formatMoney(t.amount)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!itemForm.treatmentId && (
                <>
                  <div className="form-group">
                    <label className="form-label">Description <span style={{ color: 'var(--danger-text)' }}>*</span></label>
                    <input className="form-input" value={itemForm.description}
                      onChange={e => dispatchItem({ type: 'set', field: 'description', value: e.target.value })}
                      placeholder="e.g. Consultation fee" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (AUD) <span style={{ color: 'var(--danger-text)' }}>*</span></label>
                    <input type="number" min="0.01" step="0.01" className="form-input" value={itemForm.amount}
                      onChange={e => dispatchItem({ type: 'set', field: 'amount', value: e.target.value })}
                      placeholder="0.00" required />
                  </div>
                </>
              )}
              {itemError && <div className="feedback-error">{itemError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setItemMode(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={itemLoading}>
                  {itemLoading ? 'Saving...' : 'Save item'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Items */}
        <div className="table-wrap" style={{ marginBottom: '16px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Linked treatment</th>
                <th>Amount</th>
                {isDraft && <th></th>}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map(item => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {item.treatment ? `${item.treatment.procedure}${item.treatment.toothNumber ? ` (tooth ${item.treatment.toothNumber})` : ''}` : '—'}
                  </td>
                  <td>{formatMoney(item.amount)}</td>
                  {isDraft && (
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm" onClick={() => startEditItem(item)} aria-label="Edit item">
                          <i className="ti ti-edit" />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingItemId === item.id || invoice.items.length <= 1}
                          aria-label="Delete item"
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="card" style={{ maxWidth: '320px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>Subtotal</span><span>{formatMoney(invoice.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>Discount</span><span>-{formatMoney(invoice.discount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            <span>Tax</span><span>{formatMoney(invoice.tax)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700,
            paddingTop: '10px', borderTop: '1px solid var(--border)'
          }}>
            <span>Total</span><span>{formatMoney(invoice.total)}</span>
          </div>
        </div>
      </main>
    </div>
  )
}