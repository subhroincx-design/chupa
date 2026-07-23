import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import InstallGuideModal from '../components/InstallGuideModal'



export default function Login() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('login') // 'login' | 'forgot'
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [showInstallModal, setShowInstallModal] = useState(false)

  // Login form
  const [loginId, setLoginId] = useState('')   // username OR email
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const handleThemeToggle = () => {
    const html = document.documentElement
    const nextDark = !html.classList.contains('dark')
    html.classList.toggle('dark', nextDark)
    localStorage.setItem('chupa-theme', nextDark ? 'dark' : 'light')
    setIsDark(nextDark)
  }

  // ── Login ──────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    const id = loginId.trim()
    const pw = password

    if (!id) { setLoginError('Enter your username or email'); return }
    if (!pw) { setLoginError('Enter your password'); return }

    setLoginLoading(true)
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)
      let email = id

      if (!isEmail) {
        const { data, error: lookupErr } = await supabase
          .from('profiles')
          .select('email')
          .ilike('username', id)
          .maybeSingle()

        if (lookupErr || !data) {
          setLoginError('No account found with that username')
          setLoginLoading(false)
          return
        }
        email = data.email
      }

      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (signInErr) {
        setLoginError(
          signInErr.message === 'Invalid login credentials'
            ? 'Wrong password or account not found'
            : signInErr.message
        )
      } else if (authData?.user) {
        const uId = authData.user.id
        const uName = authData.user.user_metadata?.username || ''
        const { data: bData } = await supabase
          .from('banned_users')
          .select('*')
          .or(`user_id.eq.${uId},username.ilike.${uName}`)
          .maybeSingle()

        const bannedHandles = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
        const isLocallyBanned = uName && bannedHandles.map(h => h.toLowerCase()).includes(uName.toLowerCase())

        if (bData || isLocallyBanned) {
          await supabase.auth.signOut()
          setLoginError('🚫 Your account has been suspended by Platform Owner @subhro and cannot log in.')
          setLoginLoading(false)
          return
        }
      }
    } catch (err) {
      setLoginError(err.message || 'Something went wrong')
    } finally {
      setLoginLoading(false)
    }
  }

  // ── Forgot Password ────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    setForgotError('')
    const email = forgotEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotError('Enter a valid email address')
      return
    }
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setForgotError(error.message)
      else setForgotSent(true)
    } catch (err) {
      setForgotError(err.message || 'Something went wrong')
    } finally {
      setForgotLoading(false)
    }
  }

  const inputStyle = (hasError) => ({
    width: '100%', padding: '12px 14px', fontSize: 16,
    background: 'var(--c-bg)',
    border: `1.5px solid ${hasError ? 'var(--c-danger)' : 'var(--c-border)'}`,
    borderRadius: 10, color: 'var(--c-text)',
    outline: 'none', transition: 'border-color 150ms, box-shadow 150ms',
  })

  return (
    <div style={{
      background: 'var(--c-bg)', minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      paddingTop: 'calc(24px + var(--safe-top))',
      paddingBottom: 'calc(24px + var(--safe-bottom))',
      position: 'relative',
    }}>

      <div style={{ width: '100%', maxWidth: 390 }}>

        {/* Top Header: Install App + Theme Toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20, width: '100%',
        }}>
          <button
            onClick={() => setShowInstallModal(true)}
            style={{
              padding: '7px 13px', fontSize: 12.5, fontWeight: 700,
              color: 'var(--c-accent)', background: 'var(--c-accent-light)',
              border: '1px solid rgba(5,150,105,0.25)', borderRadius: 99,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>📲</span> <span>Install App</span>
          </button>

          <button
            id="login-theme-toggle"
            onClick={handleThemeToggle}
            title="Toggle theme"
            style={{
              padding: '7px 13px', fontSize: 12.5, fontWeight: 600,
              color: 'var(--c-text-secondary)', background: 'var(--c-surface)',
              border: '1px solid var(--c-border)', borderRadius: 99,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 62, height: 62, borderRadius: 18,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            boxShadow: '0 8px 24px rgba(5,150,105,0.22)', marginBottom: 14,
          }}>
            <Logo size={38} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.03em', margin: '0 0 4px', lineHeight: 1.1 }}>
            Chupa
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--c-text-secondary)', margin: 0 }}>
            Distraction-free messaging
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 18, padding: '28px 24px', boxShadow: 'var(--shadow-md)',
        }}>

          {tab === 'login' ? (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 20px', letterSpacing: '-0.02em' }}>
                Sign in
              </h2>

              <form onSubmit={handleLogin} noValidate>
                {/* Username or Email */}
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="login-id" style={{
                    display: 'block', fontSize: 11.5, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: 'var(--c-text-secondary)', marginBottom: 7,
                  }}>
                    Username or Email
                  </label>
                  <input
                    id="login-id"
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="yourname or you@example.com"
                    autoComplete="username"
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={inputStyle(loginError)}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)' }}
                    onBlur={(e) => { e.target.style.borderColor = loginError ? 'var(--c-danger)' : 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <label htmlFor="login-password" style={{
                      fontSize: 11.5, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--c-text-secondary)',
                    }}>
                      Password
                    </label>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={inputStyle(loginError)}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)' }}
                    onBlur={(e) => { e.target.style.borderColor = loginError ? 'var(--c-danger)' : 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Forgot password link */}
                <div style={{ textAlign: 'right', marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setLoginError('') }}
                    style={{ fontSize: 12.5, color: 'var(--c-accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Forgot password?
                  </button>
                </div>

                {loginError && (
                  <div style={{
                    background: 'var(--c-danger-light)', color: 'var(--c-danger)',
                    fontSize: 12.5, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                    border: '1px solid rgba(220,38,38,0.15)', lineHeight: 1.4,
                  }}>
                    {loginError}
                  </div>
                )}

                <button
                  id="login-submit"
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
                    background: 'var(--c-accent)', color: '#fff', borderRadius: 10,
                    boxShadow: '0 3px 10px rgba(5,150,105,0.22)',
                    opacity: loginLoading ? 0.65 : 1,
                    transition: 'opacity 150ms, transform 80ms',
                    cursor: loginLoading ? 'not-allowed' : 'pointer',
                  }}
                  onMouseDown={(e) => { if (!loginLoading) e.currentTarget.style.transform = 'scale(0.98)' }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  {loginLoading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Signing in...
                    </span>
                  ) : 'Sign In →'}
                </button>
              </form>

              <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 20, paddingTop: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0 }}>
                  Don't have an account?{' '}
                  <button
                    onClick={() => navigate('/register')}
                    style={{ color: 'var(--c-accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
                  >
                    Create one →
                  </button>
                </p>
              </div>
            </>
          ) : (
            /* ── Forgot Password ── */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button
                  onClick={() => { setTab('login'); setForgotSent(false); setForgotError('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                >
                  ← Back
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', margin: 0, letterSpacing: '-0.02em' }}>
                  Reset Password
                </h2>
              </div>

              {forgotSent ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'var(--c-accent-light)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 13V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h9" />
                      <path d="M22 7l-10 7L2 7" />
                      <path d="M16 19l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 8px' }}>Check your email</h3>
                  <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
                    A password reset link has been sent to<br />
                    <strong style={{ color: 'var(--c-text)' }}>{forgotEmail}</strong>
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', margin: '0 0 20px' }}>
                    Click the link in the email to set a new password. Check spam/junk if not visible.
                  </p>
                  <button
                    onClick={() => { setTab('login'); setForgotSent(false); setForgotEmail('') }}
                    style={{
                      width: '100%', padding: '11px 0', fontSize: 13.5, fontWeight: 600,
                      background: 'var(--c-accent)', color: '#fff', borderRadius: 10, cursor: 'pointer',
                    }}
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} noValidate>
                  <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginBottom: 18, lineHeight: 1.5 }}>
                    Enter your recovery email and we'll send you a link to reset your password.
                  </p>
                  <div style={{ marginBottom: 14 }}>
                    <label htmlFor="forgot-email" style={{
                      display: 'block', fontSize: 11.5, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--c-text-secondary)', marginBottom: 7,
                    }}>
                      Recovery Email
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      style={inputStyle(forgotError)}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)' }}
                      onBlur={(e) => { e.target.style.borderColor = forgotError ? 'var(--c-danger)' : 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                  {forgotError && (
                    <div style={{
                      background: 'var(--c-danger-light)', color: 'var(--c-danger)',
                      fontSize: 12.5, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                      border: '1px solid rgba(220,38,38,0.15)',
                    }}>
                      {forgotError}
                    </div>
                  )}
                  <button
                    id="forgot-submit"
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    style={{
                      width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
                      background: 'var(--c-accent)', color: '#fff', borderRadius: 10,
                      opacity: forgotLoading || !forgotEmail.trim() ? 0.6 : 1,
                      cursor: forgotLoading || !forgotEmail.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link →'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {showInstallModal && <InstallGuideModal onClose={() => setShowInstallModal(false)} />}
    </div>
  )
}
