import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Nothing external to report to yet — console is the only sink.
    console.error('Render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)'
      }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: '32px', color: 'var(--danger-text)' }} />
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Something went wrong</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px' }}>
          The page failed to load. Reloading usually fixes it — if it keeps happening,
          let whoever maintains this know what you were doing.
        </div>

        {import.meta.env.DEV && (
          <pre style={{
            fontSize: '12px',
            color: 'var(--danger-text)',
            background: 'var(--bg-subtle)',
            padding: '12px',
            borderRadius: '8px',
            maxWidth: '600px',
            overflow: 'auto',
            textAlign: 'left'
          }}>
            {this.state.error.message}
          </pre>
        )}

        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}