import { useState, useEffect, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllInvoices, createInvoice, getUnbilledTreatments } from '../../api/invoice'
import { getAllPatients } from '../../api/clinic'
import AppSidebar from '../../components/AppSidebar'
import Pagination from '../../components/Pagination'
import '../../styles/global.css'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PARTIALLY_PAID', label: 'Partially paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'VOIDED', label: 'Voided' },
]

const STATUS_BADGE = {
  DRAFT: 'badge-pending',
  ISSUED: 'badge-completed',
  PARTIALLY_PAID: 'badge-partial',
  PAID: 'badge-paid',
  OVERDUE: 'badge-overdue',
  CANCELLED: 'badge-danger',
  VOIDED: 'badge-danger'
}

const formatMoney = (n) => `$${Number(n).toFixed(2)}`
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU') : '—'

// ── CreateInvoiceModal ─────────────────────────────────────────────────────────

const initialForm = { dueAt: '', billedToName: '', billedToEmail: '', billedToPhone: '', billedToAddress: '' }

function formReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'reset': return initialForm
    default: return state
  }
}

function CreateInvoiceModal({ onClose, onCreated }) {
  // Step 1 — find & pick a patient
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)

  // Step 2 — pick unbilled treatments
  const [treatments, setTreatments] = useState([])
  const [loadingTreatments, setLoadingTreatments] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const [form, dispatch] = useReducer(formReducer, initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  const pickPatient = async (patient) => {
    setSelectedPatient(patient)
    setLoadingTreatments(true)
    setError('')
    try {
      const data = await getUnbilledTreatments(patient.id)
      setTreatments(data.treatments)
      setSelectedIds(new Set(data.treatments.map(t => t.id)))
    } catch {
      setError('Failed to load unbilled treatments')
    } finally {
      setLoadingTreatments(false)
    }
  }

  const toggleTreatment = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedTotal = treatments
    .filter(t => selectedIds.has(t.id))
    .reduce((sum, t) => sum + t.amount, 0)

  const handleChange = (e) => {
    dispatch({ type: 'set', field: e.target.name, value: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedIds.size === 0) {
      setError('Select at least one treatment to invoice')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createInvoice({
        patientId: selectedPatient.id,
        treatmentIds: [...selectedIds],
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        billedToName: form.billedToName || undefined,
        billedToEmail: form.billedToEmail || undefined,
        billedToPhone: form.billedToPhone || undefined,
        billedToAddress: form.billedToAddress || undefined,
      })
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title">New invoice</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Step 1 — patient search */}
        {!selectedPatient && (
          <div style={{ padding: '4px 0' }}>
            <form onSubmit={handlePatientSearch} className="form">
              <div className="form-group">
                <label className="form-label">Find patient</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="form-input"
                    placeholder="Search by name..."
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn" disabled={searchingPatients}>
                    {searchingPatients ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </form>

            {error && <div className="feedback-error">{error}</div>}

            {patientResults.length > 0 && (
              <div className="table-wrap" style={{ marginTop: '12px' }}>
                <table className="table">
                  <tbody>
                    {patientResults.map(p => (
                      <tr key={p.id} onClick={() => pickPatient(p)}>
                        <td>{p.firstName} {p.lastName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.email || p.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — pick treatments & billing details */}
        {selectedPatient && (
          <form onSubmit={handleSubmit} className="form">
            <div className="detail-item" style={{ marginBottom: '4px' }}>
              <div className="detail-label">Patient</div>
              <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedPatient.firstName} {selectedPatient.lastName}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSelectedPatient(null); setTreatments([]) }}>
                  Change
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Unbilled treatments</label>
              {loadingTreatments ? (
                <div className="loading" style={{ padding: '12px 0' }}>Loading treatments...</div>
              ) : treatments.length === 0 ? (
                <div className="feedback-error">This patient has no unbilled treatments</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Procedure</th>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {treatments.map(t => (
                        <tr key={t.id} onClick={() => toggleTreatment(t.id)} style={{ cursor: 'pointer' }}>
                          <td>
                            <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleTreatment(t.id)} />
                          </td>
                          <td>{t.procedure}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{formatDate(t.appointment?.date)}</td>
                          <td>{formatMoney(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {treatments.length > 0 && (
                <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Selected subtotal: <strong>{formatMoney(selectedTotal)}</strong>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Due date</label>
              <input type="date" name="dueAt" className="form-input" value={form.dueAt} onChange={handleChange} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Billed-to name</label>
                <input name="billedToName" className="form-input" value={form.billedToName}
                  onChange={handleChange} placeholder={`${selectedPatient.firstName} ${selectedPatient.lastName}`} />
              </div>
              <div className="form-group">
                <label className="form-label">Billed-to email</label>
                <input name="billedToEmail" type="email" className="form-input" value={form.billedToEmail}
                  onChange={handleChange} placeholder={selectedPatient.email || ''} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Billed-to phone</label>
                <input name="billedToPhone" className="form-input" value={form.billedToPhone}
                  onChange={handleChange} placeholder={selectedPatient.phone || ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Billed-to address</label>
                <input name="billedToAddress" className="form-input" value={form.billedToAddress}
                  onChange={handleChange} placeholder={selectedPatient.address || ''} />
              </div>
            </div>

            {error && <div className="feedback-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading || treatments.length === 0}>
                {loading ? 'Creating...' : 'Create draft invoice'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Invoices page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function Invoices() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get('status') || ''
  const skip = parseInt(searchParams.get('skip') || '0')
  const take = parseInt(searchParams.get('take') || String(PAGE_SIZE))

  const [invoices, setInvoices] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const data = await getAllInvoices({ take, skip, status: status || undefined })
      setInvoices(data.invoices)
      setTotal(data.total)
    } catch {
      setError('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvoices() }, [searchParams])

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

  return (
    <div className="app-layout">
      <AppSidebar active="invoices" />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Invoices</div>
            <div className="page-subtitle">{total} total invoices</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> New invoice
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Status
            </label>
            <select
              className="form-select"
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ width: 'auto' }}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="loading">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-file-invoice" aria-hidden="true" />
              <div className="empty-title">No invoices found</div>
              <div className="empty-subtitle">
                {status ? 'Try a different status filter' : 'Create an invoice to get started'}
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} onClick={() => navigate(`/clinic/invoices/${inv.id}`)}>
                    <td style={{ color: !inv.invoiceNumber ? 'var(--text-hint)' : 'inherit' }}>
                      {inv.invoiceNumber || 'Draft'}
                    </td>
                    <td>{inv.patient?.firstName} {inv.patient?.lastName}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[inv.status]}`}>
                        {inv.status.toLowerCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(inv.dueAt)}</td>
                    <td>{formatMoney(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              skip={skip}
              take={take}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {showCreate && (
          <CreateInvoiceModal
            onClose={() => setShowCreate(false)}
            onCreated={() => fetchInvoices()}
          />
        )}
      </main>
    </div>
  )
}