import { useState, useEffect, useReducer } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getAllProcedures, createProcedure, updateProcedure,
  deactivateProcedure, reactivateProcedure
} from '../../api/procedureCatalog'
import AppSidebar from '../../components/layout/AppSidebar'
import Pagination from '../../components/ui/Pagination'
import '../../styles/global.css'

const PAGE_SIZE = 20
const emptyForm = { code: '', name: '', category: '', defaultAmount: '' }

function formReducer(state, action) {
  switch (action.type) {
    case 'set': return { ...state, [action.field]: action.value }
    case 'init': return action.payload
    default: return state
  }
}

function ProcedureModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, dispatch] = useReducer(formReducer, initial ? {
    code: initial.code || '',
    name: initial.name,
    category: initial.category || '',
    defaultAmount: initial.defaultAmount.toString()
  } : emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    dispatch({ type: 'set', field: e.target.name, value: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        category: form.category.trim() || null,
        defaultAmount: parseFloat(form.defaultAmount)
      }
      const data = isEdit
        ? await updateProcedure(initial.id, payload)
        : await createProcedure(payload)
      onSaved(data.procedure)
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
          <div className="modal-title">{isEdit ? 'Edit procedure' : 'New procedure'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label className="form-label">Name <span>*</span></label>
            <input name="name" className="form-input" value={form.name} onChange={handleChange}
              placeholder="e.g. Cleaning" required autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Code</label>
              <input name="code" className="form-input" value={form.code} onChange={handleChange}
                placeholder="e.g. D1110" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input name="category" className="form-input" value={form.category} onChange={handleChange}
                placeholder="e.g. Preventive" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Default amount (AUD) <span>*</span></label>
            <input name="defaultAmount" type="number" min="0.01" step="0.01" className="form-input"
              value={form.defaultAmount} onChange={handleChange} placeholder="0.00" required />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Create procedure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Procedures() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const activeParam = searchParams.get('active')
  const skip = parseInt(searchParams.get('skip') || '0')
  const take = parseInt(searchParams.get('take') || String(PAGE_SIZE))

  const [searchInput, setSearchInput] = useState(search)
  const [procedures, setProcedures] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const fetchProcedures = async () => {
    try {
      setLoading(true)
      const data = await getAllProcedures({
        take, skip,
        search: search || undefined,
        active: activeParam !== null ? activeParam : undefined
      })
      setProcedures(data.procedures)
      setTotal(data.total)
    } catch {
      setError('Failed to load procedures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProcedures() }, [searchParams])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (searchInput.trim()) next.set('search', searchInput.trim())
      else next.delete('search')
      next.set('skip', '0')
      return next
    })
  }

  const handleActiveFilter = (value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === '') next.delete('active')
      else next.set('active', value)
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

  const handleToggleActive = async (procedure) => {
    setTogglingId(procedure.id)
    setError('')
    try {
      if (procedure.active) {
        await deactivateProcedure(procedure.id)
        setFeedback(`${procedure.name} deactivated`)
      } else {
        await reactivateProcedure(procedure.id)
        setFeedback(`${procedure.name} reactivated`)
      }
      await fetchProcedures()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="app-layout">
      <AppSidebar active="procedures" />
      <main className="main">

        <div className="page-header">
          <div>
            <div className="page-title">Procedures</div>
            <div className="page-subtitle">{total} total procedures</div>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditingProcedure(null); setShowModal(true) }}>
            <i className="ti ti-plus" aria-hidden="true" /> New procedure
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
          <form onSubmit={handleSearchSubmit} className="search-wrap">
            <i className="ti ti-search" aria-hidden="true" />
            <input className="search-input" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by name or code..." />
          </form>
          <select className="form-select" style={{ width: 'auto' }}
            value={activeParam ?? ''} onChange={e => handleActiveFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {loading ? (
          <div className="loading">Loading procedures...</div>
        ) : procedures.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-list-check" aria-hidden="true" />
              <div className="empty-title">No procedures found</div>
              <div className="empty-subtitle">Add one to build out the price list</div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Default amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {procedures.map(p => (
                  <tr key={p.id} onClick={() => { setEditingProcedure(p); setShowModal(true) }}>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.code || '—'}</td>
                    <td>{p.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.category || '—'}</td>
                    <td>${p.defaultAmount.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${p.active ? 'badge-active' : 'badge-suspended'}`}>
                        {p.active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm" disabled={togglingId === p.id}
                        onClick={() => handleToggleActive(p)}>
                        {togglingId === p.id ? '...' : p.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination skip={skip} take={take} total={total} onPageChange={handlePageChange} />
          </div>
        )}

        {showModal && (
          <ProcedureModal
            initial={editingProcedure}
            onClose={() => setShowModal(false)}
            onSaved={() => fetchProcedures()}
          />
        )}
      </main>
    </div>
  )
}