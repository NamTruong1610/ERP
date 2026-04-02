import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { verifyEmailChange } from '../../api/user'
import '../auth/auth.css'
 
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
 
  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-label">Verifying</div>
          <h1 className="auth-title">Confirming your email...</h1>
        </div>
      </div>
    )
  }
 
  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-label">Success</div>
          <h1 className="auth-title">Email updated</h1>
          <p className="auth-subtitle">Your email address has been changed successfully.</p>
          <div className="auth-link">
            <Link to="/profile">Back to profile</Link>
          </div>
        </div>
      </div>
    )
  }
 
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-label">Error</div>
        <h1 className="auth-title">Verification failed</h1>
        <p className="auth-subtitle">{error}</p>
        <div className="auth-link">
          <Link to="/profile">Back to profile</Link>
        </div>
      </div>
    </div>
  )
}