import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../api/auth'
import './auth.css'
 
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
 
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword({ email })
      setSubmitted(true) // always show success to avoid email enumeration
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
 
  if (submitted) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-label">Check your inbox</div>
          <h1 className="auth-title">Recovery email sent</h1>
          <p className="auth-subtitle">
            If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly. Check your spam folder if you don't see it.
          </p>
          <div className="auth-link">
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    )
  }
 
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-label">Account recovery</div>
        <h1 className="auth-title">Forgot your password?</h1>
        <p className="auth-subtitle">
          Enter your email address and we'll send you a link to reset your password.
        </p>
 
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="you@example.com"
              required
            />
          </div>
 
          {error && <div className="auth-error">{error}</div>}
 
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
 
        <div className="auth-link">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}