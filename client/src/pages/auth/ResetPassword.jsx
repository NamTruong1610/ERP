import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../../api/auth'
import './auth.css'
 
export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const recoveryToken = searchParams.get('token')
  const navigate = useNavigate()
 
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
 
  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }
 
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!recoveryToken) {
      setError('Invalid reset link')
      return
    }
    setLoading(true)
    try {
      await resetPassword({
        password: form.password,
        confirmPassword: form.confirmPassword,
        recoveryToken
      })
      navigate('/login', { state: { passwordReset: true } })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
 
  if (!recoveryToken) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-label">Invalid link</div>
          <h1 className="auth-title">Reset link is invalid</h1>
          <p className="auth-subtitle">This password reset link is missing or malformed.</p>
          <div className="auth-link">
            <Link to="/forgot-password">Request a new link</Link>
          </div>
        </div>
      </div>
    )
  }
 
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-label">Account recovery</div>
        <h1 className="auth-title">Set a new password</h1>
        <p className="auth-subtitle">Choose a strong password for your account.</p>
 
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
 
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
 
          {error && <div className="auth-error">{error}</div>}
 
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}