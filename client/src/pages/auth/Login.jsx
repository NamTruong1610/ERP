import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { getProfile } from '../../api/user'
import { login as loginApi } from '../../api/auth'
import './auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, user, loading: sessionLoading } = useAuth()
  const activated = location.state?.activated

  const [form, setForm] = useState({ email: '', password: '', rememberMe: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!sessionLoading && user) {
      navigate('/profile')
    }
  }, [user, sessionLoading])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await loginApi(form) 

      // MFA required — pass token to verify page
      if (data.mfaLoginTokenId) {
        navigate('/login/mfa', { state: { mfaLoginTokenId: data.mfaLoginTokenId } })
        return
      }

      // No MFA — logged in
      // fetch profile and update context
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
        <div className="auth-label">Welcome back</div>
        <h1 className="auth-title">Sign in to your account</h1>
        <p className="auth-subtitle">Enter your credentials to continue.</p>

        {activated && (
          <div className="auth-success" style={{ marginBottom: '24px' }}>
            Account activated successfully. You can now log in.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
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

          <div className="remember-row">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={form.rememberMe}
              onChange={handleChange}
            />
            <label htmlFor="rememberMe">Remember me for 7 days</label>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-link">
          <Link to="/forgot-password">Forgot your password?</Link>
        </div>
      </div>
    </div>
  )
}