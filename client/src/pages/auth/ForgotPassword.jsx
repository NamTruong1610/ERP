import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'
import '../../styles/global.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
  e.preventDefault()
  setLoading(true)
  try {
    await forgotPassword({ email })
  } catch {
    // Always show success to prevent email enumeration
  } finally {
    setSubmitted(true)
    setLoading(false)
  }
}

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-page)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px' }}>
            <i className="ti ti-tooth" style={{ fontSize: '28px' }} aria-hidden="true" />
            <span style={{ fontSize: '20px', fontWeight: 600 }}>DentaCore</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Reset your password
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Enter your email and we'll send you a reset link
          </div>
        </div>

        <div className="card">
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <i className="ti ti-mail" style={{ fontSize: '32px', color: 'var(--primary)', display: 'block', marginBottom: '12px' }} aria-hidden="true" />
              <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>Check your email</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                If an account exists for {email}, a reset link has been sent.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email" className="form-input"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/login" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}