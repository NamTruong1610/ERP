import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { verifyEmailChange } from '../../api/user'
import '../../styles/global.css'

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams()
  const tokenId = searchParams.get('token')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tokenId) {
      setError('Invalid verification link')
      setLoading(false)
      return
    }
    const verify = async () => {
      try {
        await verifyEmailChange({ tokenId })
        setSuccess(true)
      } catch (err) {
        setError(err.response?.data?.message || 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [])

  const wrapper = (icon, title, subtitle, link) => (
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
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <i className={`ti ${icon}`} style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }} aria-hidden="true" />
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{title}</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>{subtitle}</div>
          <Link to="/profile" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
            {link}
          </Link>
        </div>
      </div>
    </div>
  )

  if (loading) return wrapper('ti-loader', 'Confirming your email...', 'Please wait a moment.', '')
  if (success) return wrapper('ti-circle-check', 'Email updated', 'Your email address has been changed successfully.', '← Back to profile')
  return wrapper('ti-circle-x', 'Verification failed', error, '← Back to profile')
}