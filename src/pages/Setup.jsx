import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sanitizeInput } from '../utils/sanitize'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'

export default function Setup() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [nameError, setNameError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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

  useEffect(() => {
    if (user?.user_metadata?.name && !name) setName(user.user_metadata.name)
    if (user?.user_metadata?.username && !username) setUsername(user.user_metadata.username)
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleanName = sanitizeInput(name)
    const cleanUsername = sanitizeInput(username)
    if (cleanName.length < 2) { setNameError('At least 2 characters'); return }
    if (cleanUsername.length < 3) { setUsernameError('At least 3 characters'); return }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id, email: user.email, name: cleanName, username: cleanUsername,
        name_changed_at: new Date().toISOString(), username_changed_at: new Date().toISOString(),
      })
      if (error) {
        if (error.code === '23505') setUsernameError('Username already taken')
        else if (error.code === 'PGRST205') setUsernameError('Run the SQL setup in Supabase first!')
        else setUsernameError(error.message)
        setSubmitting(false)
        return
      }

      if (avatarFile) {
        try {
          const ext = avatarFile.name.split('.').pop().toLowerCase()
          const path = `${user.id}/avatar.${ext}`
          await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
          await supabase.rpc('update_avatar', { p_user_id: user.id, p_new_url: `${publicUrl}?v=${Date.now()}` })
        } catch (err) {
          console.warn('Avatar upload failed:', err)
        }
      }

      await refreshProfile()
      navigate('/dashboard', { replace: true })
    } catch { setUsernameError('Something went wrong') }
    finally { setSubmitting(false) }
  }

  const canSubmit = !submitting && name.trim().length >= 2 && username.length >= 3 && !usernameError && !checking

  return (
    <div style={{
      background: 'var(--c-bg)',
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      paddingTop: 'calc(24px + var(--safe-top))',
      paddingBottom: 'calc(24px + var(--safe-bottom))',
    }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            boxShadow: '0 6px 20px rgba(5,150,105,0.22)',
            marginBottom: 14,
          }}>
            <Logo size={34} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.03em', margin: '0 0 6px' }}>
            Set Up Your Profile
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--c-text-secondary)', margin: 0 }}>
            Choose a name, handle, and photo
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 16,
          padding: '28px 24px',
          boxShadow: 'var(--shadow-md)',
        }}>
          <form onSubmit={handleSubmit}>

            {/* Avatar picker */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarPick}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'relative', background: 'none', padding: 0, cursor: 'pointer', border: 'none', display: 'inline-block' }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--c-accent)' }} />
                ) : (
                  <Avatar name={name || '?'} size={84} />
                )}
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--c-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2.5px solid var(--c-surface)',
                  boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </button>
              <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 8 }}>
                Tap to add a photo (optional)
              </p>
            </div>

            {/* Display name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-secondary)', marginBottom: 8 }}>
                Display Name
              </label>
              <input
                id="setup-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value.slice(0, 50)); setNameError('') }}
                placeholder="e.g. Alex Morgan"
                autoFocus
                required
                autoComplete="name"
                autoCapitalize="words"
                style={{
                  width: '100%', padding: '12px 16px',
                  fontSize: 16,
                  background: 'var(--c-bg)',
                  border: `1.5px solid ${nameError ? 'var(--c-danger)' : 'var(--c-border)'}`,
                  borderRadius: 10, color: 'var(--c-text)',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => { if (!nameError) { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.1)' } }}
                onBlur={(e) => { e.target.style.borderColor = nameError ? 'var(--c-danger)' : 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
              />
              {nameError && <p className="fade-in" style={{ fontSize: 12, color: 'var(--c-danger)', marginTop: 5 }}>{nameError}</p>}
            </div>

            {/* Username */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-secondary)', marginBottom: 8 }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontFamily: 'monospace', color: 'var(--c-text-tertiary)', pointerEvents: 'none' }}>@</span>
                <input
                  id="setup-username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="your_handle"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  style={{
                    width: '100%', padding: '12px 46px 12px 34px',
                    fontSize: 16, fontFamily: 'monospace',
                    background: 'var(--c-bg)',
                    border: `1.5px solid ${usernameError ? 'var(--c-danger)' : usernameAvailable ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    borderRadius: 10, color: 'var(--c-text)',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={(e) => { if (!usernameError) { e.target.style.borderColor = usernameAvailable ? 'var(--c-accent)' : 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.1)' } }}
                  onBlur={(e) => { e.target.style.borderColor = usernameError ? 'var(--c-danger)' : usernameAvailable ? 'var(--c-accent)' : 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
                />
                {checking && (
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--c-text-tertiary)', animation: 'pulse-dot 1s infinite' }}>…</span>
                )}
                {!checking && usernameAvailable && username.length >= 3 && (
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--c-accent)', fontWeight: 700 }}>✓</span>
                )}
              </div>
              {usernameError && <p className="fade-in" style={{ fontSize: 12, color: 'var(--c-danger)', marginTop: 5 }}>{usernameError}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: 'var(--c-text-tertiary)' }}>
                <span>Spaces → underscores</span>
                <span style={{ fontFamily: 'monospace' }}>{username.length}/20</span>
              </div>
            </div>

            <button
              id="setup-submit"
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '13px 0',
                fontSize: 15, fontWeight: 600,
                background: 'var(--c-accent)', color: '#fff',
                borderRadius: 10,
                boxShadow: '0 3px 10px rgba(5,150,105,0.22)',
                opacity: canSubmit ? 1 : 0.5,
                transition: 'opacity 150ms, transform 80ms',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              onMouseDown={(e) => { if (canSubmit) e.target.style.transform = 'scale(0.98)' }}
              onMouseUp={(e) => { e.target.style.transform = 'scale(1)' }}
              onMouseLeave={(e) => { e.target.style.transform = 'scale(1)' }}
            >
              {submitting ? 'Creating profile...' : 'Complete & Start Chatting →'}
            </button>
          </form>
        </div>

        <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', textAlign: 'center', marginTop: 20 }}>
          Signed in as {user?.email}
        </p>
      </div>
    </div>
  )
}
