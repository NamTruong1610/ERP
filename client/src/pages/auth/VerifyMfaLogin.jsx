import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { verifyMfaLogin, getMe } from '../../api/auth'
import { useAuth } from '../../context/useAuth'
import '../../styles/global.css'

export default function VerifyMfaLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login: loginUser } = useAuth()
  const { mfaLoginTokenId, rememberMe } = location.state || {}
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!mfaLoginTokenId) navigate('/login')
  }, [mfaLoginTokenId])

  if (!mfaLoginTokenId) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await verifyMfaLogin({ mfaLoginTokenId, otp, rememberMe })
      const me = await getMe()  // ← fetch user after cookies are set
      loginUser(me)
      navigate('/home')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code')
      setOtp('')
    } finally {
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
            Two-factor authentication
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Enter the 6-digit code from your authenticator app
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label className="form-label">Authentication code</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                className="form-input" value={otp}
                onChange={e => { setOtp(e.target.value); setError('') }}
                placeholder="000000" required autoFocus
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '18px' }}
              />
            </div>
            {error && <div className="feedback-error">{error}</div>}
            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}