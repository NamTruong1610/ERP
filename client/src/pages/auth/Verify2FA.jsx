import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { verify2faSetup } from '../../api/activation'
import './activation.css'
 
export default function Verify2FA() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activationToken, mfaToken } = location.state || {}
 
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
 
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activationToken || !mfaToken) {
      navigate('/activate')
      return
    }
    setLoading(true)
    try {
      await verify2faSetup({ otp, activationToken, mfaToken })
      navigate('/login', { state: { activated: true } })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
 
  return (
    <div className="activation-container">
      <div className="activation-card">
        <div className="activation-step">Step 3 of 3</div>
        <h1 className="activation-title">Verify your authenticator</h1>
        <p className="activation-subtitle">
          Enter the 6-digit code from your authenticator app to complete setup.
        </p>
 
        <form onSubmit={handleSubmit} className="activation-form">
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
 
          {error && <div className="activation-error">{error}</div>}
 
          <button type="submit" className="activation-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}