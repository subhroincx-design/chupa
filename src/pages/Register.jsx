import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'

function InputField({ id, label, type, value, onChange, placeholder, autoComplete, autoFocus, error, prefix, suffix, hint }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{
        display: 'block', fontSize: 11.5, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        color: 'var(--c-text-secondary)', marginBottom: 7,
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--c-text-tertiary)', pointerEvents: 'none', fontFamily: 'monospace' }}>
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: `12px 14px 12px ${prefix ? '32px' : '14px'}`,
            fontSize: 16,
            background: 'var(--c-bg)',
            border: `1.5px solid ${error ? 'var(--c-danger)' : focused ? 'var(--c-accent)' : 'var(--c-border)'}`,
            borderRadius: 10, color: 'var(--c-text)',
            boxShadow: focused ? '0 0 0 3px rgba(5,150,105,0.08)' : 'none',
            transition: 'border-color 150ms, box-shadow 150ms',
            outline: 'none',
            fontFamily: type === 'password' ? 'inherit' : (prefix ? 'monospace' : 'inherit'),
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--c-danger)', margin: '5px 0 0' }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: '5px 0 0' }}>{hint}</p>}
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')

  const [nameError, setNameError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [globalError, setGlobalError] = useState('')

  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  const usernameRegex = /^[a-zA-Z0-9_]+$/

  const checkUsername = useCallback(
    (() => {
      let timeout
      return (value) => {
        clearTimeout(timeout)
        setUsernameAvailable(null)
        if (!value || value.length < 3) { setChecking(false); return }
        if (!usernameRegex.test(value)) { setUsernameError('Letters, numbers, and underscores only'); setChecking(false); return }
        setChecking(true)
        timeout = setTimeout(async () => {
          try {
            const { data } = await supabase.from('profiles').select('id').ilike('username', value).limit(1)
            setUsernameAvailable(!data || data.length === 0)
            setUsernameError(data && data.length > 0 ? 'Already taken' : '')
          } catch { setUsernameError('') }
          finally { setChecking(false) }
        }, 300)
      }
    })(),
    []
  )

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)
    setUsername(val)
    setUsernameError('')
    checkUsername(val)
  }

  const handleAvatarPick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)) return
    if (f.size > 5 * 1024 * 1024) return
    setAvatarFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGlobalError('')

    // Validate
    let hasErr = false
    if (name.trim().length < 2) { setNameError('At least 2 characters'); hasErr = true }
    if (username.length < 3) { setUsernameError('At least 3 characters'); hasErr = true }
    if (password.length < 6) { setPasswordError('At least 6 characters'); hasErr = true }
    if (password !== confirmPassword) { setPasswordError('Passwords do not match'); hasErr = true }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailError('Enter a valid email'); hasErr = true }
    if (usernameError || !usernameAvailable) { setUsernameError(usernameError || 'Choose a different username'); hasErr = true }
    if (hasErr) return

    setSubmitting(true)
    try {
      // 1. Create auth user with email + password
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username, name: name.trim() } },
      })

      if (signUpErr) {
        setGlobalError(signUpErr.message)
        setSubmitting(false)
        return
      }

      const userId = signUpData.user?.id
      if (!userId) {
        setGlobalError('Registration failed. Try again.')
        setSubmitting(false)
        return
      }

      // 2. Insert profile row
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        email: email.trim(),
        name: name.trim(),
        username: username,
        name_changed_at: new Date().toISOString(),
        username_changed_at: new Date().toISOString(),
      })

      if (profileErr) {
        if (profileErr.code === '23505') setUsernameError('Username already taken')
        else setGlobalError(profileErr.message)
        setSubmitting(false)
        return
      }

      // 3. Upload avatar if provided
      if (avatarFile) {
        try {
          const ext = avatarFile.name.split('.').pop().toLowerCase()
          const path = `${userId}/avatar.${ext}`
          await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
          await supabase.rpc('update_avatar', { p_user_id: userId, p_new_url: `${publicUrl}?v=${Date.now()}` })
        } catch (err) {
          console.warn('Avatar upload failed:', err)
        }
      }

      setSuccess(true)
    } catch (err) {
      setGlobalError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !submitting && name.trim().length >= 2 && username.length >= 3 &&
    !usernameError && !checking && password.length >= 6 && email.trim().length > 0

  if (success) {
    return (
      <div style={{
        background: 'var(--c-bg)', minHeight: '100dvh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '24px 20px',
      }}>
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <div style={{
            width: 70, height: 70, borderRadius: '50%',
            background: 'var(--c-accent-light)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            Account Created! 🎉
          </h2>
          <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.6, margin: '0 0 8px' }}>
            Check your email at <strong style={{ color: 'var(--c-text)' }}>{email}</strong> to confirm your account.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--c-text-tertiary)', margin: '0 0 24px', lineHeight: 1.5 }}>
            After confirming, sign in with your username and password. Check spam/junk if not visible.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
              background: 'var(--c-accent)', color: '#fff', borderRadius: 10, cursor: 'pointer',
            }}
          >
            Go to Sign In →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--c-bg)', minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      paddingTop: 'calc(24px + var(--safe-top))',
      paddingBottom: 'calc(24px + var(--safe-bottom))',
    }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 420 }}>

        {/* Back to login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => navigate('/login')}
            style={{ fontSize: 13, color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ← Sign In
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            boxShadow: '0 6px 20px rgba(5,150,105,0.22)', marginBottom: 12,
          }}>
            <Logo size={34} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.03em', margin: '0 0 6px' }}>
            Create Account
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--c-text-secondary)', margin: 0 }}>
            Join Chupa — takes 30 seconds
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 18, padding: '28px 24px', boxShadow: 'var(--shadow-md)',
        }}>
          <form onSubmit={handleSubmit} noValidate>

            {/* Avatar Picker */}
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarPick} style={{ display: 'none' }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'relative', background: 'none', padding: 0, cursor: 'pointer', border: 'none', display: 'inline-block' }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--c-accent)' }} />
                ) : (
                  <Avatar name={name || '?'} size={80} />
                )}
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--c-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2.5px solid var(--c-surface)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </button>
              <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', marginTop: 7 }}>Tap to add a photo (optional)</p>
            </div>

            {/* Display Name */}
            <InputField
              id="reg-name"
              label="Display Name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value.slice(0, 50)); setNameError('') }}
              placeholder="e.g. Alex Morgan"
              autoComplete="name"
              autoFocus
              error={nameError}
            />

            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-username" style={{
                display: 'block', fontSize: 11.5, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--c-text-secondary)', marginBottom: 7,
              }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontFamily: 'monospace', color: 'var(--c-text-tertiary)', pointerEvents: 'none' }}>@</span>
                <input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="your_handle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{
                    width: '100%', padding: '12px 46px 12px 34px', fontSize: 16, fontFamily: 'monospace',
                    background: 'var(--c-bg)',
                    border: `1.5px solid ${usernameError ? 'var(--c-danger)' : usernameAvailable ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    borderRadius: 10, color: 'var(--c-text)',
                    transition: 'border-color 150ms, box-shadow 150ms', outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)' }}
                  onBlur={(e) => { e.target.style.boxShadow = 'none' }}
                />
                {checking && <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--c-text-tertiary)', animation: 'pulse-dot 1s infinite' }}>…</span>}
                {!checking && usernameAvailable && username.length >= 3 && (
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--c-accent)', fontWeight: 700 }}>✓</span>
                )}
              </div>
              {usernameError && <p style={{ fontSize: 12, color: 'var(--c-danger)', margin: '5px 0 0' }}>{usernameError}</p>}
              {!usernameError && <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: '5px 0 0' }}>People will find you with this. Letters, numbers, underscores.</p>}
            </div>

            {/* Password */}
            <InputField
              id="reg-password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError('') }}
              placeholder="min 6 characters"
              autoComplete="new-password"
              error={passwordError}
              hint="At least 6 characters"
            />

            {/* Confirm Password */}
            <InputField
              id="reg-confirm"
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
              placeholder="repeat your password"
              autoComplete="new-password"
            />

            {/* Email for Recovery */}
            <InputField
              id="reg-email"
              label="Recovery Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
              placeholder="you@example.com"
              autoComplete="email"
              error={emailError}
              hint="Used only to recover your password"
            />

            {globalError && (
              <div style={{
                background: 'var(--c-danger-light)', color: 'var(--c-danger)',
                fontSize: 12.5, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                border: '1px solid rgba(220,38,38,0.15)', lineHeight: 1.4,
              }}>
                {globalError}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
                background: 'var(--c-accent)', color: '#fff', borderRadius: 10,
                boxShadow: '0 3px 10px rgba(5,150,105,0.22)',
                opacity: canSubmit ? 1 : 0.5,
                transition: 'opacity 150ms, transform 80ms',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              onMouseDown={(e) => { if (canSubmit) e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {submitting ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Creating account...
                </span>
              ) : 'Create Account & Start Chatting →'}
            </button>
          </form>
        </div>

        <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>
          By creating an account you agree to use Chupa responsibly.
        </p>
      </div>
    </div>
  )
}
