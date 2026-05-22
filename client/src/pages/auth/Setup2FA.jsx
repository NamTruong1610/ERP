import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { get2faSecret } from '../../api/activation'
import '../../styles/global.css'

export default function Setup2FA() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activationToken, mfaToken } = location.state || {}
  const [qrUri, setQrUri] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activationToken || !mfaToken) { navigate('/login'); return }
    const load = async () => {
      try {
        const data = await get2faSecret({ activationToken, mfaToken })
        setQrUri(data.mfaUri)
        setSecret(data.mfaSecret)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load QR code')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
            Step 2 of 3
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Set up two-factor authentication
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Scan the QR code with Google Authenticator or Authy
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading">Loading QR code...</div>
          ) : error ? (
            <div className="feedback-error">{error}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUri)}&size=180x180`}
                alt="QR code" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Can't scan? Enter this code manually:
                </div>
                <code style={{
                  fontSize: '13px', fontFamily: 'monospace', background: 'var(--bg-subtle)',
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  letterSpacing: '0.1em'
                }}>
                  {secret}
                </code>
              </div>
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                onClick={() => navigate('/activate/2fa/verify', { state: { activationToken, mfaToken } })}>
                I've scanned the code — continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}