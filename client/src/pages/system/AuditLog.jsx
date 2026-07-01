import { useState, useEffect, useCallback } from 'react'
import AppSidebar from '../../components/AppSidebar'
import { getAuditLogs } from '../../api/system'
import '../../styles/global.css'

const timeAgo = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

const formatDate = (d) =>
  new Date(d).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })

const actionColor = (action) => {
  if (action.includes('DELETED') || action.includes('PURGED') || action.includes('FAILED'))
    return 'var(--danger-text)'
  if (action.includes('CREATED') || action.includes('ACTIVATED') || action.includes('UPLOADED'))
    return 'var(--success-text)'
  if (action.includes('SUSPENDED') || action.includes('REVOKED') || action.includes('RESET'))
    return 'var(--warning-text)'
  return 'var(--text-secondary)'
}

export default function AuditLog() {
  const [logs,      setLogs]      = useState([])
  const [cursor,    setCursor]    = useState(null)
  const [hasMore,   setHasMore]   = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,     setError]     = useState('')
  const [expanded,  setExpanded]  = useState(null)

  const fetchLogs = useCallback(async (nextCursor = null) => {
    try {
      nextCursor ? setLoadingMore(true) : setLoading(true)
      const data = await getAuditLogs({ cursor: nextCursor, take: 50 })
      setLogs(prev => nextCursor ? [...prev, ...data.logs] : data.logs)
      setCursor(data.nextCursor ?? null)
      setHasMore(data.hasMore ?? false)
    } catch {
      setError('Failed to load audit logs')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const formatActor = (log) => {
    if (log.actorType === 'SYSTEM') return 'System'
    if (!log.actorId) return 'Unknown'
    return log.actorId.slice(0, 8) + '…'
  }

  return (
    <div className="app-layout">
      <AppSidebar active="system-audit" />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">Audit log</div>
            <div className="page-subtitle">{logs.length} entries loaded</div>
          </div>
          <button
            className="btn"
            onClick={() => { setLogs([]); setCursor(null); fetchLogs() }}
          >
            <i className="ti ti-refresh" aria-hidden="true" /> Refresh
          </button>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div className="loading">Loading audit log...</div>
        ) : logs.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              <i className="ti ti-list-details" aria-hidden="true" />
              <div className="empty-title">No audit entries</div>
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
                        <span title={formatDate(log.createdAt)}>{timeAgo(log.createdAt)}</span>
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
                        {log.targetType && (
                          <span>
                            {log.targetType.toLowerCase()}
                            {log.targetId && (
                              <span style={{ fontFamily: 'var(--font-mono)', marginLeft: '4px', color: 'var(--text-hint)' }}>
                                {log.targetId.slice(0, 8)}…
                              </span>
                            )}
                          </span>
                        )}
                        {!log.targetType && '—'}
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

                    {/* Expanded metadata row */}
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
                  onClick={() => fetchLogs(cursor)}
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