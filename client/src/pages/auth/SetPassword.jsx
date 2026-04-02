import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setPassword } from '../../api/activation'
import './activation.css'
 
export default function SetPassword() {
  const [searchParams] = useSearchParams()
  const activationToken = searchParams.get('token')
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
    if (!activationToken) {
      setError('Invalid activation link')
      return
    }
    setLoading(true)
    try {
      const data = await setPassword({
        activationToken,
        password: form.password,
        confirmPassword: form.confirmPassword
      })
      navigate('/activate/2fa', {
        state: {
          activationToken: data.activationToken,
          mfaToken: data.mfaToken
        }
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
 
  return (
    <div className="activation-container">
      <div className="activation-card">
        <div className="activation-step">Step 1 of 3</div>
        <h1 className="activation-title">Set your password</h1>
        <p className="activation-subtitle">Choose a strong password to secure your account.</p>
 
        <form onSubmit={handleSubmit} className="activation-form">
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
            />
          </div>
 
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm password"
              required
            />
          </div>
 
          {error && <div className="activation-error">{error}</div>}
 
          <button type="submit" className="activation-btn" disabled={loading}>
            {loading ? 'Setting password...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
 