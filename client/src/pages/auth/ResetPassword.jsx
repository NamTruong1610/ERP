import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../../api/auth'
import { useAuth } from '../../context/useAuth'
import '../../styles/global.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home', { replace: true })
    }
  }, [user, authLoading])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword({ ...form, recoveryToken: token })
      navigate('/login')
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
            Set a new password
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Choose a strong password for your account
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label className="form-label">New password</label>
              <input name="password" type="password" className="form-input"
                value={form.password} onChange={handleChange}
                placeholder="••••••••" required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input name="confirmPassword" type="password" className="form-input"
                value={form.confirmPassword} onChange={handleChange}
                placeholder="••••••••" required />
            </div>
            {error && <div className="feedback-error">{error}</div>}
            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading}>
              {loading ? 'Saving...' : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}