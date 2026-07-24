import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppSidebar from '../../components/layout/AppSidebar'
import { getAuditLogs } from '../../api/system'
import { timeAgo, formatDateTimeLong } from '../../lib/format'
import '../../styles/global.css'

// ── Constants ──────────────────────────────────────────────────────────────────

const ACTOR_TYPE_OPTIONS = [
  { value: '', label: 'All actors' },
  { value: 'USER', label: 'User' },
  { value: 'SYSTEM', label: 'System' },
]

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'All targets' },
  { value: 'USER', label: 'User' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'APPOINTMENT', label: 'Appointment' },
  { value: 'TREATMENT', label: 'Treatment' },
  { value: 'FILE', label: 'File' },
  { value: 'SESSION', label: 'Session' },
  { value: 'ROLE', label: 'Role' },
]

// Actions grouped by category — rendered as <optgroup> in the select
const ACTION_GROUPS = [
  {
    label: 'Auth',
    options: [
      'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_MFA_PENDING', 'LOGIN_MFA_FAILED',
      'LOGOUT', 'LOGOUT_ALL', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET', 'PASSWORD_CHANGED'
    ]
  },
  {
    label: 'Users',
    options: [
      'USER_CREATED', 'USER_ACTIVATED', 'USER_UPDATED', 'USER_DELETED',
      'USER_SUSPENDED', 'USER_REACTIVATED', 'EMAIL_CHANGED', 'EMAIL_CHANGE_REQUESTED',
      'MFA_ENABLED', 'MFA_DISABLED', 'MFA_RESET', 'ROLE_ASSIGNED', 'ROLE_REMOVED',
      'FORCE_LOGOUT', 'ACTIVATION_RESENT'
    ]
  },
  {
    label: 'Patients',
    options: ['PATIENT_CREATED', 'PATIENT_UPDATED', 'PATIENT_DELETED']
  },
  {
    label: 'Appointments',
    options: [
      'APPOINTMENT_CREATED', 'APPOINTMENT_UPDATED',
      'APPOINTMENT_CANCELLED', 'APPOINTMENT_DELETED'
    ]
  },
  {
    label: 'Treatments',
    options: ['TREATMENT_CREATED', 'TREATMENT_UPDATED', 'TREATMENT_DELETED']
  },
  {
    label: 'Files',
    options: ['FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_DELETED', 'FILE_PURGED']
  },
  {
    label: 'Sessions',
    options: ['SESSION_REVOKED']
  },
]

const TRIGGER_OPTIONS = [
  { value: '', label: 'All triggers' },
  { value: 'USER_ACTION', label: 'User action' },
  { value: 'ADMIN_ACTION', label: 'Admin action' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'CASCADE', label: 'Cascade' },
]

const currentYear = new Date().getFullYear()
const DATE_PRESET_OPTIONS = [
  { value: '', label: 'Custom range' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  ...Array.from(
    { length: currentYear - 2024 + 1 },
    (_, i) => currentYear - i
  ).map(y => ({ value: String(y), label: String(y) }))
]

// ── Helpers ────────────────────────────────────────────────────────────────────

const actionColor = (action) => {
  if (action.includes('DELETED') || action.includes('PURGED') || action.includes('FAILED'))
    return 'var(--danger-text)'
  if (action.includes('CREATED') || action.includes('ACTIVATED') || action.includes('UPLOADED'))
    return 'var(--success-text)'
  if (action.includes('SUSPENDED') || action.includes('REVOKED') || action.includes('RESET'))
    return 'var(--warning-text)'
  return 'var(--text-secondary)'
}

// Converts a date preset string into { from, to } ISO strings
// so the backend receives concrete date boundaries regardless of
// whether the user picked a preset or typed a custom range
const resolvePreset = (preset) => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (preset === 'today') return {
    from: startOfToday.toISOString(),
    to: endOfToday.toISOString()
  }

  // Rolling N-day windows — subtract N-1 days from start of today
  // so "last 7 days" includes today + the 6 days before it
  if (preset === '7d' || preset === '30d' || preset === '90d') {
    const days = parseInt(preset)  // '7d' → 7, '30d' → 30, '90d' → 90
    const from = new Date(startOfToday)
    from.setDate(from.getDate() - (days - 1))
    return {
      from: from.toISOString(),
      to: endOfToday.toISOString()
    }
  }

  if (/^\d{4}$/.test(preset)) return {
    from: new Date(parseInt(preset), 0, 1, 0, 0, 0, 0).toISOString(),
    to: new Date(parseInt(preset), 11, 31, 23, 59, 59, 999).toISOString()
  }

  return { from: '', to: '' }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AuditLog() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Read all filter values from the URL.
  // These drive both the filter UI and the API call.
  const actorType = searchParams.get('actorType') || ''
  const targetType = searchParams.get('targetType') || ''
  const action = searchParams.get('action') || ''
  const trigger = searchParams.get('trigger') || ''
  const preset = searchParams.get('preset') || ''
  const fromDate = searchParams.get('from') || ''
  const toDate = searchParams.get('to') || ''

  // Logs and cursor live in React state — they can't live in the URL
  // because they're an accumulating list (load more appends to it)
  // and the cursor is an opaque value only meaningful to the backend
  const [logs, setLogs] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  // Resolve the effective from/to — preset takes priority over manual range.
  // If a preset is selected, compute its date boundaries on the fly.
  // If no preset, use whatever the user typed into from/to directly.

  // Fresh fetch — called when filters change.
  // Resets the logs list and cursor back to the beginning.
  const fetchFresh = useCallback(async () => {
    // Compute resolved dates inside the function, not outside
    // so they're always fresh when the fetch runs
    const resolved = preset ? resolvePreset(preset) : { from: fromDate, to: toDate }

    try {
      setLoading(true)
      setLogs([])
      setCursor(null)
      const data = await getAuditLogs({
        take: 50,
        actorType: actorType || undefined,
        targetType: targetType || undefined,
        action: action || undefined,
        trigger: trigger || undefined,
        from: resolved.from || undefined,
        to: resolved.to || undefined,
      })
      setLogs(data.logs)
      setCursor(data.nextCursor ?? null)
      setHasMore(data.hasMore ?? false)
    } catch {
      setError('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [searchParams])
  // searchParams as the dependency — any filter change in the URL
  // triggers a fresh fetch automatically, same pattern as Patients/Appointments

  // Append fetch — called when "Load more" is clicked.
  // Sends the current cursor alongside the same filters so the backend
  // knows to continue from where the last page ended, within the
  // same filtered result set.
  const fetchMore = async () => {
    if (!cursor) return
    const resolved = preset ? resolvePreset(preset) : { from: fromDate, to: toDate }

    try {
      setLoadingMore(true)
      const data = await getAuditLogs({
        take: 50,
        cursor,
        actorType: actorType || undefined,
        targetType: targetType || undefined,
        action: action || undefined,
        trigger: trigger || undefined,
        from: resolved.from || undefined,
        to: resolved.to || undefined,
      })
      setLogs(prev => [...prev, ...data.logs])
      setCursor(data.nextCursor ?? null)
      setHasMore(data.hasMore ?? false)
    } catch {
      setError('Failed to load more logs')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { fetchFresh() }, [fetchFresh])

  // Writing a filter to the URL — always resets to a fresh result set
  // because the filter changed, so the old cursor is no longer valid
  const setFilter = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  // Preset selected — write preset to URL and clear manual from/to.
  // The resolved from/to are computed on the fly from the preset string,
  // so there's no need to write them to the URL separately.
  const handlePresetChange = (value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set('preset', value)
      } else {
        next.delete('preset')
      }
      // Clear manual range when preset is selected
      next.delete('from')
      next.delete('to')
      return next
    })
  }

  // Manual date range changed — write from/to to URL and clear preset.
  // Preset and manual range are mutually exclusive.
  const handleDateChange = (key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      // Clear preset when user manually sets a date range
      next.delete('preset')
      return next
    })
  }

  const clearFilters = () => {
    setSearchParams({})
  }

  const hasActiveFilters = actorType || targetType || action || trigger || preset || fromDate || toDate

  const formatActor = (log) => {
    if (log.actorType === 'SYSTEM') return 'System'
    if (!log.actorId) return 'Unknown'
    return log.actorId.slice(0, 8) + '…'
  }

  return (
    <div className="app-layout">
      <AppSidebar active="system-audit" />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Audit log</div>
            <div className="page-subtitle">{logs.length} entries loaded</div>
          </div>
          <button
            className="btn"
            onClick={() => { setSearchParams({}); fetchFresh() }}
          >
            <i className="ti ti-refresh" aria-hidden="true" /> Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>

          {/* Actor type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Actor
            </label>
            <select
              className="form-select"
              value={actorType}
              onChange={e => setFilter('actorType', e.target.value)}
              style={{ width: 'auto' }}
            >
              {ACTOR_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Target type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Target
            </label>
            <select
              className="form-select"
              value={targetType}
              onChange={e => setFilter('targetType', e.target.value)}
              style={{ width: 'auto' }}
            >
              {TARGET_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Action — grouped by category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Action
            </label>
            <select
              className="form-select"
              value={action}
              onChange={e => setFilter('action', e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All actions</option>
              {ACTION_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map(a => (
                    <option key={a} value={a}>{a.toLowerCase().replace(/_/g, ' ')}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Trigger */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Trigger
            </label>
            <select
              className="form-select"
              value={trigger}
              onChange={e => setFilter('trigger', e.target.value)}
              style={{ width: 'auto' }}
            >
              {TRIGGER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Date preset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Preset
            </label>
            <select
              className="form-select"
              value={preset}
              onChange={e => handlePresetChange(e.target.value)}
              style={{ width: 'auto' }}
            >
              {DATE_PRESET_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Date range — from */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              From
            </label>
            <input
              type="date"
              className="form-input"
              value={fromDate}
              onChange={e => handleDateChange('from', e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>

          {/* Date range — to */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              To
            </label>
            <input
              type="date"
              className="form-input"
              value={toDate}
              onChange={e => handleDateChange('to', e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={clearFilters}
              style={{ color: 'var(--text-hint)', fontSize: '12px', alignSelf: 'flex-end' }}
            >
              <i className="ti ti-x" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="loading">Loading audit log...</div>
        ) : logs.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-list-details" aria-hidden="true" />
              <div className="empty-title">No audit entries</div>
              <div className="empty-subtitle">
                {hasActiveFilters ? 'Try adjusting your filters' : 'No activity recorded yet'}
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>IP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <>
                    <tr
                      key={log.id}
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      style={{ cursor: log.metadata ? 'pointer' : 'default' }}
                    >
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        <div>{timeAgo(log.createdAt)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-hint)' }}>
                          {formatDateTimeLong(log.createdAt)}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '12px', fontWeight: 600,
                          color: actionColor(log.action),
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatActor(log)}
                        </span>
                        <span style={{ marginLeft: '4px', color: 'var(--text-hint)', fontSize: '11px' }}>
                          {log.actorType?.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {log.targetType ? (
                          <span>
                            {log.targetType.toLowerCase()}
                            {log.targetId && (
                              <span style={{ fontFamily: 'var(--font-mono)', marginLeft: '4px', color: 'var(--text-hint)' }}>
                                {log.targetId.slice(0, 8)}…
                              </span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-hint)', fontFamily: 'var(--font-mono)' }}>
                        {log.ip ?? '—'}
                      </td>
                      <td>
                        {log.metadata && (
                          <i
                            className={`ti ${expanded === log.id ? 'ti-chevron-up' : 'ti-chevron-down'}`}
                            style={{ fontSize: '14px', color: 'var(--text-hint)' }}
                          />
                        )}
                      </td>
                    </tr>

                    {expanded === log.id && log.metadata && (
                      <tr key={`${log.id}-meta`}>
                        <td colSpan={6} style={{ padding: '0 16px 12px', background: 'var(--bg-card)' }}>
                          <pre style={{
                            fontSize: '11px', color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)', margin: 0,
                            padding: '8px 12px', borderRadius: '6px',
                            background: 'var(--bg-page)', overflowX: 'auto'
                          }}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {hasMore && (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <button
                  className="btn"
                  onClick={fetchMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}