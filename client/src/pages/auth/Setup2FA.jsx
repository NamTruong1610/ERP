import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { get2faSecret } from '../../api/activation'
import './activation.css'
 
export default function Setup2FA() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activationToken, mfaToken } = location.state || {}
 
  const [qrUri, setQrUri] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
 
  useEffect(() => {
    if (!activationToken || !mfaToken) {
      navigate('/activate')
      return
    }
 
    const fetchSecret = async () => {
      try {
        const data = await get2faSecret({ activationToken, mfaToken })
        setQrUri(data.qrUri)
      } catch (err) {
        setError(err.response?.data?.message || 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
 
    fetchSecret()
  }, [])
 
  const handleContinue = () => {
    navigate('/activate/2fa/verify', {
      state: { activationToken, mfaToken }
    })
  }
 
  return (
    <div className="activation-container">
      <div className="activation-card">
        <div className="activation-step">Step 2 of 3</div>
        <h1 className="activation-title">Set up two-factor authentication</h1>
        <p className="activation-subtitle">
          Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
        </p>
 
        {loading && <div className="activation-loading">Loading QR code...</div>}
 
        {error && <div className="activation-error">{error}</div>}
 
        {qrUri && !loading && (
          <div className="qr-container">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUri)}&size=200x200`}
              alt="2FA QR Code"
              className="qr-image"
            />
            <p className="qr-hint">Can't scan? Enter the code manually in your authenticator app.</p>
          </div>
        )}
 
        <button
          className="activation-btn"
          onClick={handleContinue}
          disabled={loading || !!error}
        >
          I've scanned the QR code
        </button>
      </div>
    </div>
  )
}