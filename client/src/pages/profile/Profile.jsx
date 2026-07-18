import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getProfile, updateName, addPhone, removePhone,
  addAddress, updateAddress, removeAddress,
  changePassword, changeEmail, disable2fa, enable2fa
} from '../../api/user'
import { useAuth } from '../../context/useAuth'
import AppSidebar from '../../components/AppSidebar'
import '../../styles/global.css'

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div className="card-title">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{value || '—'}</span>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { logoutUser, updateUser } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const [showNameEdit, setShowNameEdit] = useState(false)
  const [nameForm, setNameForm] = useState({ fName: '', mName: '', lName: '' })
  const [nameLoading, setNameLoading] = useState(false)

  const [newPhone, setNewPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [addressForm, setAddressForm] = useState({ street: '', suburb: '', post: '', city: '' })
  const [addressLoading, setAddressLoading] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' })
  const [emailLoading, setEmailLoading] = useState(false)

  const [show2faForm, setShow2faForm] = useState(false)
  const [tfaForm, setTfaForm] = useState({ password: '', otp: '' })
  const [tfaLoading, setTfaLoading] = useState(false)

  const fetchProfile = async () => {
    try {
      const data = await getProfile()
      setProfile(data)
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfile() }, [])

  const showFeedback = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    setNameLoading(true)
    try {
      const data = await updateName({ name: nameForm })
      setProfile(prev => ({ ...prev, name: data.name }))
      updateUser({ name: data.name })
      showFeedback('Name updated')
      setShowNameEdit(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setNameLoading(false)
    }
  }

  const handleAddPhone = async (e) => {
    e.preventDefault()
    setPhoneLoading(true)
    try {
      const data = await addPhone({ phone: newPhone })
      setProfile(prev => ({ ...prev, phones: data.phones }))
      setNewPhone('')
      showFeedback('Phone added')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setPhoneLoading(false)
    }
  }

  const handleRemovePhone = async (phone) => {
    try {
      // removePhone expects { phone } — passing the bare string was sending
      // DELETE /user/phones/undefined on every call.
      const data = await removePhone({ phone })
      setProfile(prev => ({ ...prev, phones: data.phones }))
      showFeedback('Phone removed')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const handleAddressSubmit = async (e) => {
    e.preventDefault()
    setAddressLoading(true)
    try {
      let data
      if (editingAddressId) {
        data = await updateAddress({ addressId: editingAddressId, address: addressForm })
        showFeedback('Address updated')
      } else {
        data = await addAddress({ address: addressForm })
        showFeedback('Address added')
      }
      setProfile(prev => ({ ...prev, addresses: data.addresses }))
      setShowAddressForm(false)
      setEditingAddressId(null)
      setAddressForm({ street: '', suburb: '', post: '', city: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setAddressLoading(false)
    }
  }

  const handleRemoveAddress = async (id) => {
    try {
      const data = await removeAddress({ addressId: id })
      setProfile(prev => ({ ...prev, addresses: data.addresses }))
      showFeedback('Address removed')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordLoading(true)
    try {
      await changePassword(passwordForm)
      showFeedback('Password changed — please sign in again')
      setShowPasswordForm(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setTimeout(() => { logoutUser(); navigate('/login') }, 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setEmailLoading(true)
    try {
      await changeEmail(emailForm)
      showFeedback('Verification email sent — check your inbox')
      setShowEmailForm(false)
      setEmailForm({ newEmail: '', password: '' })
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setEmailLoading(false)
    }
  }

  const handle2faSubmit = async (e) => {
    e.preventDefault()
    setTfaLoading(true)
    try {
      if (profile.mfaEnabled) {
        await disable2fa(tfaForm)
        showFeedback('2FA disabled')
        logoutUser()
        navigate('/login')
      } else {
        await enable2fa(tfaForm)
        showFeedback('2FA enabled')
      }
      setShow2faForm(false)
      setTfaForm({ password: '', otp: '' })
      await fetchProfile()
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setTfaLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading profile...</div>

  const fullName = profile?.name
    ? [profile.name.fName, profile.name.mName, profile.name.lName].filter(Boolean).join(' ')
    : '—'

  const initials = profile?.name
    ? `${profile.name.fName?.[0] ?? ''}${profile.name.lName?.[0] ?? ''}`.toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="app-layout">
      <AppSidebar active="profile" />
      <main className="main" style={{ maxWidth: '720px' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '16px' }}>{initials}</div>
            <div>
              <div className="page-title">{fullName}</div>
              <div className="page-subtitle">{profile?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {profile?.roles?.map(r => (
              <span key={r.id} className={`badge badge-${r.role.toLowerCase()}`}>{r.role.toLowerCase()}</span>
            ))}
          </div>
        </div>

        {error && <div className="feedback-error" style={{ marginBottom: '16px' }} onClick={() => setError('')}>{error}</div>}
        {feedback && <div className="feedback-success" style={{ marginBottom: '16px' }}>{feedback}</div>}

        {/* Name */}
        <Section title="Personal information">
          {!showNameEdit ? (
            <>
              <Field label="First name" value={profile?.name?.fName} />
              <Field label="Middle name" value={profile?.name?.mName} />
              <Field label="Last name" value={profile?.name?.lName} />
              <div style={{ marginTop: '12px' }}>
                <button className="btn btn-sm" onClick={() => {
                  setNameForm({ fName: profile?.name?.fName || '', mName: profile?.name?.mName || '', lName: profile?.name?.lName || '' })
                  setShowNameEdit(true)
                }}>
                  <i className="ti ti-edit" /> Edit name
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleNameSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input className="form-input" value={nameForm.fName}
                    onChange={e => setNameForm(p => ({ ...p, fName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Middle name</label>
                  <input className="form-input" value={nameForm.mName}
                    onChange={e => setNameForm(p => ({ ...p, mName: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Last name</label>
                <input className="form-input" value={nameForm.lName}
                  onChange={e => setNameForm(p => ({ ...p, lName: e.target.value }))} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowNameEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={nameLoading}>
                  {nameLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </Section>

        {/* Phones */}
        <Section title="Phone numbers">
          {profile?.phones?.length ? (
            <div style={{ marginBottom: '12px' }}>
              {profile.phones.map(phone => (
                <div key={phone} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '13px' }}>{phone}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRemovePhone(phone)}
                    style={{ color: 'var(--danger-text)' }}>
                    <i className="ti ti-trash" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-hint)', marginBottom: '12px' }}>No phones added</div>
          )}
          <form onSubmit={handleAddPhone} style={{ display: 'flex', gap: '8px' }}>
            <input className="form-input" style={{ flex: 1 }} value={newPhone}
              onChange={e => setNewPhone(e.target.value)} placeholder="Add phone number" />
            <button type="submit" className="btn btn-primary" disabled={phoneLoading || !newPhone}>
              {phoneLoading ? '...' : 'Add'}
            </button>
          </form>
        </Section>

        {/* Addresses */}
        <Section title="Addresses">
          {profile?.addresses?.length ? (
            <div style={{ marginBottom: '12px' }}>
              {profile.addresses.map(addr => (
                <div key={addr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {[addr.street, addr.suburb, addr.post, addr.city].filter(Boolean).join(', ')}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setAddressForm({ street: addr.street || '', suburb: addr.suburb || '', post: addr.post || '', city: addr.city || '' })
                      setEditingAddressId(addr.id)
                      setShowAddressForm(true)
                    }}>
                      <i className="ti ti-edit" />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveAddress(addr.id)}
                      style={{ color: 'var(--danger-text)' }}>
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-hint)', marginBottom: '12px' }}>No addresses added</div>
          )}
          {showAddressForm ? (
            <form onSubmit={handleAddressSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Street</label>
                  <input className="form-input" value={addressForm.street}
                    onChange={e => setAddressForm(p => ({ ...p, street: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Suburb</label>
                  <input className="form-input" value={addressForm.suburb}
                    onChange={e => setAddressForm(p => ({ ...p, suburb: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Postcode</label>
                  <input className="form-input" value={addressForm.post}
                    onChange={e => setAddressForm(p => ({ ...p, post: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={addressForm.city}
                    onChange={e => setAddressForm(p => ({ ...p, city: e.target.value }))} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => { setShowAddressForm(false); setEditingAddressId(null) }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addressLoading}>
                  {addressLoading ? 'Saving...' : editingAddressId ? 'Update address' : 'Add address'}
                </button>
              </div>
            </form>
          ) : (
            <button className="btn btn-sm" onClick={() => { setAddressForm({ street: '', suburb: '', post: '', city: '' }); setShowAddressForm(true) }}>
              <i className="ti ti-plus" /> Add address
            </button>
          )}
        </Section>

        {/* Password */}
        <Section title="Password">
          {!showPasswordForm ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Change your account password</span>
              <button className="btn btn-sm" onClick={() => setShowPasswordForm(true)}>
                <i className="ti ti-lock" /> Change password
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="form">
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input type="password" className="form-input" value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">New password</label>
                  <input type="password" className="form-input" value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm password</label>
                  <input type="password" className="form-input" value={passwordForm.confirmNewPassword}
                    onChange={e => setPasswordForm(p => ({ ...p, confirmNewPassword: e.target.value }))} required />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowPasswordForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
                  {passwordLoading ? 'Saving...' : 'Change password'}
                </button>
              </div>
            </form>
          )}
        </Section>

        {/* Email */}
        <Section title="Email address">
          {!showEmailForm ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{profile?.email}</span>
              <button className="btn btn-sm" onClick={() => setShowEmailForm(true)}>
                <i className="ti ti-mail" /> Change email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="form">
              <div className="form-group">
                <label className="form-label">New email</label>
                <input type="email" className="form-input" value={emailForm.newEmail}
                  onChange={e => setEmailForm(p => ({ ...p, newEmail: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input type="password" className="form-input" value={emailForm.password}
                  onChange={e => setEmailForm(p => ({ ...p, password: e.target.value }))} required />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowEmailForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={emailLoading}>
                  {emailLoading ? 'Sending...' : 'Send verification'}
                </button>
              </div>
            </form>
          )}
        </Section>

        {/* 2FA */}
        <Section title="Two-factor authentication">
          {!show2faForm ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  2FA is currently&nbsp;
                </span>
                <span className={`badge ${profile?.mfaEnabled ? 'badge-active' : 'badge-pending'}`}>
                  {profile?.mfaEnabled ? 'enabled' : 'disabled'}
                </span>
              </div>
              <button
                className={`btn btn-sm ${profile?.mfaEnabled ? 'btn-danger' : ''}`}
                onClick={() => setShow2faForm(true)}>
                {profile?.mfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
          ) : (
            <form onSubmit={handle2faSubmit} className="form">
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input type="password" className="form-input" value={tfaForm.password}
                  onChange={e => setTfaForm(p => ({ ...p, password: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Authentication code</label>
                <input type="text" className="form-input" value={tfaForm.otp}
                  onChange={e => setTfaForm(p => ({ ...p, otp: e.target.value }))}
                  placeholder="000000" maxLength={6}
                  style={{ letterSpacing: '0.2em', textAlign: 'center' }} required />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShow2faForm(false)}>Cancel</button>
                <button type="submit" className={`btn ${profile?.mfaEnabled ? 'btn-danger' : 'btn-primary'}`} disabled={tfaLoading}>
                  {tfaLoading ? 'Processing...' : profile?.mfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
            </form>
          )}
        </Section>
      </main>
    </div>
  )
}