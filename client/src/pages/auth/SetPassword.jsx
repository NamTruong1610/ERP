import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setPassword } from '../../api/activation'
import '../../styles/global.css'

export default function SetPassword() {
  const [searchParams] = useSearchParams()
  const activationToken = searchParams.get('token')
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      if (!activationToken) {
        setError('Invalid activation link')
        setChecking(false)
        return
      }
      try {
        const data = await setPassword({ activationToken, password: null, confirmPassword: null })
        if (data.passwordRequired === false) {
          navigate('/activate/2fa', {
            state: { activationToken: data.activationToken, mfaToken: data.mfaToken }
          })
        } else {
          setChecking(false)
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid or expired token')
        setChecking(false)
      }
    }
    checkStatus()
  }, [])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activationToken) { setError('Invalid activation link'); return }
    setLoading(true)
    try {
      const data = await setPassword({ activationToken, ...form })
      navigate('/activate/2fa', {
        state: { activationToken: data.activationToken, mfaToken: data.mfaToken }
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return <div className="loading">Loading...</div>

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-page)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px' }}>
            <i className="ti ti-tooth" style={{ fontSize: '28px' }} aria-hidden="true" />
            <span style={{ fontSize: '20px', fontWeight: 600 }}>DentaCore</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px' }}>
            Step 1 of 3
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Set your password
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Choose a strong password to secure your account
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label className="form-label">Password</label>
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
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}