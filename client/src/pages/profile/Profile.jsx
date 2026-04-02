import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import {
  getProfile,
  updateName,
  addPhone,
  removePhone,
  addAddress,
  updateAddress,
  removeAddress,
  changePassword,
  changeEmail,
  disable2fa,
  enable2fa
} from '../../api/user'
import { logout } from '../../api/auth'
import './profile.css'



// ─── Name Section ──────────────────────────────────────────────────────────────
function NameSection({ profile, onUpdate }) {
  const [form, setForm] = useState({
    fName: profile.name?.fName || '',
    mName: profile.name?.mName || '',
    lName: profile.name?.lName || ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await updateName({ name: form })
      setSuccess('Name updated successfully')
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-section">
      <div className="section-header">
        <div className="section-title">Name</div>
        <div className="section-subtitle">Update your display name.</div>
      </div>
      <div className="profile-card">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-row">
            <div className="form-group">
              <label>First name</label>
              <input
                value={form.fName}
                onChange={e => setForm(p => ({ ...p, fName: e.target.value }))}
                placeholder="John"
              />
            </div>
            <div className="form-group">
              <label>Last name</label>
              <input
                value={form.lName}
                onChange={e => setForm(p => ({ ...p, lName: e.target.value }))}
                placeholder="Smith"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Middle name (optional)</label>
            <input
              value={form.mName}
              onChange={e => setForm(p => ({ ...p, mName: e.target.value }))}
              placeholder="Paul"
            />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          {success && <div className="feedback-success">{success}</div>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Phones Section ────────────────────────────────────────────────────────────
function PhonesSection({ phones, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await addPhone({ phone: newPhone })
      setNewPhone('')
      setShowAdd(false)
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (phone) => {
    try {
      await removePhone({ phone })
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <div className="profile-section">
      <div className="section-header">
        <div className="section-title">Phone numbers</div>
        <div className="section-subtitle">Manage your contact numbers.</div>
      </div>

      {phones.map((phone, i) => (
        <div key={i} className="list-item">
          <span className="list-item-text">{phone}</span>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleRemove(phone)}
          >
            Remove
          </button>
        </div>
      ))}

      {error && <div className="feedback-error" style={{ marginBottom: '8px' }}>{error}</div>}

      {showAdd ? (
        <div className="profile-card">
          <form onSubmit={handleAdd} className="profile-form">
            <div className="form-group">
              <label>Phone number</label>
              <input
                type="tel"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="+61 400 000 000"
                required
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setShowAdd(false); setNewPhone(''); setError('') }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Adding...' : 'Add phone'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button className="add-toggle" onClick={() => setShowAdd(true)}>
          + Add phone number
        </button>
      )}
    </div>
  )
}

// ─── Addresses Section ─────────────────────────────────────────────────────────
const AddressForm = ({ form, setForm, onSubmit, submitLabel, onCancel, error, loading }) => (
  <form onSubmit={onSubmit} className="profile-form">
    <div className="form-group">
      <label>Street</label>
      <input
        value={form.street}
        onChange={e => setForm(p => ({ ...p, street: e.target.value }))}
        placeholder="123 Main St"
      />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Suburb</label>
        <input
          value={form.suburb}
          onChange={e => setForm(p => ({ ...p, suburb: e.target.value }))}
          placeholder="Haymarket"
        />
      </div>
      <div className="form-group">
        <label>Postcode</label>
        <input
          value={form.post}
          onChange={e => setForm(p => ({ ...p, post: e.target.value }))}
          placeholder="2000"
        />
      </div>
    </div>
    <div className="form-group">
      <label>City</label>
      <input
        value={form.city}
        onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
        placeholder="Sydney"
      />
    </div>
    {error && <div className="feedback-error">{error}</div>}
    <div className="form-actions">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Saving...' : submitLabel}
      </button>
    </div>
  </form>
)

function AddressesSection({ addresses, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ street: '', suburb: '', post: '', city: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const resetForm = () => setForm({ street: '', suburb: '', post: '', city: '' })

  const handleCancel = () => {
    setEditingId(null)
    setShowAdd(false)
    resetForm()
    setError('')
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await addAddress({ address: form })
      resetForm()
      setShowAdd(false)
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e, addressId) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await updateAddress({ addressId, address: form })
      setEditingId(null)
      resetForm()
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (addressId) => {
    try {
      await removeAddress({ addressId })
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const startEdit = (address) => {
    setEditingId(address._id)
    setForm({
      street: address.street || '',
      suburb: address.suburb || '',
      post: address.post || '',
      city: address.city || ''
    })
    setShowAdd(false)
  }

  return (
    <div className="profile-section">
      <div className="section-header">
        <div className="section-title">Addresses</div>
        <div className="section-subtitle">Manage your saved addresses.</div>
      </div>

      {addresses.map((address) => (
        <div key={address._id}>
          {editingId === address._id ? (
            <div className="profile-card">
              <AddressForm
                form={form}
                setForm={setForm}
                onSubmit={(e) => handleUpdate(e, address._id)}
                submitLabel="Save changes"
                onCancel={handleCancel}
                error={error}
                loading={loading}
              />
            </div>
          ) : (
            <div className="list-item">
              <div>
                <div className="list-item-text">{address.street}</div>
                <div className="list-item-sub">
                  {[address.suburb, address.post, address.city].filter(Boolean).join(', ')}
                </div>
              </div>
              <div className="list-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(address)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemove(address._id)}>Remove</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <div className="profile-card">
          <AddressForm
            form={form}
            setForm={setForm}
            onSubmit={handleAdd}
            submitLabel="Add address"
            onCancel={handleCancel}
            error={error}
            loading={loading}
          />
        </div>
      ) : (
        !editingId && (
          <button className="add-toggle" onClick={() => setShowAdd(true)}>
            + Add address
          </button>
        )
      )}
    </div>
  )
}

// ─── Password Section ──────────────────────────────────────────────────────────
function PasswordSection({ navigate }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await changePassword(form)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-section">
      <div className="section-header">
        <div className="section-title">Change password</div>
        <div className="section-subtitle">You will be logged out of all devices after changing your password.</div>
      </div>
      <div className="profile-card">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label>Current password</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="form-group">
            <label>New password</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm new password</label>
            <input
              type="password"
              value={form.confirmNewPassword}
              onChange={e => setForm(p => ({ ...p, confirmNewPassword: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Changing...' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Email Section ─────────────────────────────────────────────────────────────
function EmailSection({ currentEmail }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await changeEmail(form)
      setSuccess(`A verification email has been sent to ${form.email}. Check your inbox to confirm the change.`)
      setForm({ email: '', password: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-section">
      <div className="section-header">
        <div className="section-title">Change email</div>
        <div className="section-subtitle">Current email: <strong>{currentEmail}</strong></div>
      </div>
      <div className="profile-card">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label>New email address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="new@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm with your password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          {success && <div className="feedback-success">{success}</div>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send verification email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 2FA Section ───────────────────────────────────────────────────────────────
function TwoFASection({ mfaEnabled, navigate }) {
  const [enabled, setEnabled] = useState(mfaEnabled)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ password: '', otp: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleToggle = () => {
    setShowForm(true)
    setError('')
    setForm({ password: '', otp: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (enabled) {
        await disable2fa(form)
        navigate('/login') // force re-login after disabling
      } else {
        await enable2fa(form)
        setEnabled(true)
        setShowForm(false)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-section">
      <div className="section-header">
        <div className="section-title">Two-factor authentication</div>
        <div className="section-subtitle">Add an extra layer of security to your account.</div>
      </div>
      <div className="profile-card">
        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Authenticator app</div>
            <div className="toggle-desc">
              {enabled ? '2FA is currently enabled.' : '2FA is currently disabled.'}
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              disabled={showForm}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="profile-form" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {enabled
                ? 'Enter your password and current OTP to disable 2FA. You will be logged out of all devices.'
                : 'Enter your password and OTP from your authenticator app to re-enable 2FA.'}
            </p>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="form-group">
              <label>One-time code</label>
              <input
                type="text"
                value={form.otp}
                onChange={e => setForm(p => ({ ...p, otp: e.target.value }))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                required
              />
            </div>
            {error && <div className="feedback-error">{error}</div>}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setShowForm(false); setError('') }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`btn ${enabled ? 'btn-danger' : 'btn-primary'}`}
                disabled={loading}
              >
                {loading ? 'Processing...' : enabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Main Profile Page ─────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const { isAdmin, logoutUser } = useAuth()

  const fetchProfile = async () => {
    try {
      const data = await getProfile()
      setProfile(data)
    } catch (err) {
      if (err.response?.status === 401) navigate('/login')
      else setError('Failed to load profile')
    }
  }

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getProfile()
        setProfile(data)
      } catch (err) {
        if (err.response?.status === 401) navigate('/login')
        else setError('Failed to load profile')
      }
    }
    loadProfile()
  }, [])

  const handleLogout = async () => {
    await logout()
    logoutUser()
    navigate('/login')
  }

  if (!profile) {
    return (
      <div className="profile-loading">
        {error || 'Loading...'}
      </div>
    )
  }

  return (
    <div className="profile-layout">
      <aside className="profile-sidebar">
        <div className="sidebar-logo">ERP</div>
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Account</span>
          <a href="#name" className="sidebar-link">Name</a>
          <a href="#phones" className="sidebar-link">Phones</a>
          <a href="#addresses" className="sidebar-link">Addresses</a>
          <span className="sidebar-section-label">Security</span>
          <a href="#password" className="sidebar-link">Password</a>
          <a href="#email" className="sidebar-link">Email</a>
          <a href="#2fa" className="sidebar-link">Two-factor auth</a>
          {isAdmin() && (
            <>
              <span className="sidebar-section-label">Admin</span>
              <a href="/admin/users" className="sidebar-link">User management</a>
            </>
          )}
          <span className="sidebar-section-label">Session</span>
          <button
            className="sidebar-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--error)' }}
            onClick={handleLogout}
          >
            Sign out
          </button>
        </nav>
      </aside>

      <main className="profile-main">
        <div id="name">
          <NameSection profile={profile} onUpdate={fetchProfile} />
        </div>
        <div id="phones">
          <PhonesSection phones={profile.phones || []} onUpdate={fetchProfile} />
        </div>
        <div id="addresses">
          <AddressesSection addresses={profile.addresses || []} onUpdate={fetchProfile} />
        </div>
        <div id="password">
          <PasswordSection navigate={navigate} />
        </div>
        <div id="email">
          <EmailSection currentEmail={profile.email} />
        </div>
        <div id="2fa">
          <TwoFASection mfaEnabled={profile.mfaEnabled} navigate={navigate} />
        </div>
      </main>
    </div>
  )
}