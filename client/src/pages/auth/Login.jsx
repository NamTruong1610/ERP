import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, getMe } from '../../api/auth'
import { useAuth } from '../../context/useAuth'
import '../../styles/global.css'

export default function Login() {
  const navigate = useNavigate()
  const { user, loading: authLoading, login: loginUser } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', rememberMe: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home', { replace: true })
    }
  }, [user, authLoading])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await login(form)
      if (data.mfaLoginTokenId) {
        navigate('/login/mfa', { state: { mfaLoginTokenId: data.mfaLoginTokenId, rememberMe: form.rememberMe } })
      } else {
        const me = await getMe()
        loginUser(me)
        navigate('/home')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <div className="loading">Loading...</div>

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
            Sign in to your account
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Enter your credentials to continue
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                name="email" type="email" className="form-input"
                value={form.email} onChange={handleChange}
                placeholder="you@example.com" required autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                name="password" type="password" className="form-input"
                value={form.password} onChange={handleChange}
                placeholder="••••••••" required
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" name="rememberMe" checked={form.rememberMe} onChange={handleChange} />
              Remember me for 7 days
            </label>
            {error && <div className="feedback-error">{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/forgot-password" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  )
}