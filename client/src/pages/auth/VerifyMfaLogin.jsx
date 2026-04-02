import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { verifyMfaLogin } from '../../api/auth'
import { useAuth } from '../../context/useAuth'
import { getProfile } from '../../api/user'
import './auth.css'

export default function VerifyMfaLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mfaLoginTokenId } = location.state || {}
  const { login } = useAuth()

  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!mfaLoginTokenId) {
    navigate('/login')
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await verifyMfaLogin({ otp, mfaLoginTokenId })
      const profile = await getProfile()
      login(profile)
      navigate('/profile')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-label">Two-factor authentication</div>
        <h1 className="auth-title">Enter your OTP</h1>
        <p className="auth-subtitle">
          Open your authenticator app and enter the 6-digit code for this account.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="otp">One-time code</label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value)
                setError('')
              }}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  )
}