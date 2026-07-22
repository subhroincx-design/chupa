import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

export default function Login() {
  const { authError } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    if (authError) {
      setError(authError)
    }
  }, [authError])

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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const cleanEmail = email.trim()

    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
        },
      })

      if (otpError) {
        setError(otpError.message)
      } else {
        setSent(true)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--c-bg)',
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      paddingTop: 'calc(24px + var(--safe-top))',
      paddingBottom: 'calc(24px + var(--safe-bottom))',
      position: 'relative',
    }}>

      {/* Theme toggle */}
      <button
        id="login-theme-toggle"
        onClick={handleThemeToggle}
        title="Toggle theme"
        style={{
          position: 'absolute', top: 'calc(16px + var(--safe-top))', right: 16,
          padding: '8px 14px', fontSize: 13, fontWeight: 500,
          color: 'var(--c-text-secondary)',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 99,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: 'var(--shadow-sm)',
          transition: 'border-color 150ms',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--c-accent)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--c-border)'}
      >
        {isDark ? '☀️ Light' : '🌙 Dark'}
      </button>

      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 18,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            boxShadow: '0 8px 24px rgba(5,150,105,0.22)',
            marginBottom: 14,
          }}>
            <Logo size={36} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.03em', margin: '0 0 4px', lineHeight: 1.1 }}>
            Chupa
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--c-text-secondary)', margin: 0, fontWeight: 400 }}>
            Distraction-free messaging
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 16,
          padding: '28px 24px',
          boxShadow: 'var(--shadow-md)',
        }}>
          {sent ? (
            /* ── Sent state ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--c-accent-light)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 13V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h9" />
                  <path d="M22 7l-10 7L2 7" />
                  <path d="M16 19l2 2 4-4" />
                </svg>
              </div>

              <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Check your email
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
                Sign-in link sent to<br />
                <strong style={{ color: 'var(--c-text)', fontWeight: 600 }}>{email}</strong>
              </p>

              <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', lineHeight: 1.5, margin: '0 0 20px' }}>
                Tap the link in the email to log in instantly.
              </p>

              <button
                onClick={() => { setSent(false); setEmail('') }}
                style={{
                  width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 500,
                  background: 'var(--c-surface-hover)',
                  color: 'var(--c-text-secondary)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 10, cursor: 'pointer',
                  transition: 'background 120ms, color 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-surface-hover)'; e.currentTarget.style.color = 'var(--c-text-secondary)' }}
              >
                Use another email
              </button>
            </div>
          ) : (
            /* ── Email form ── */
            <form onSubmit={handleSubmit}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--c-text-secondary)', marginBottom: 8,
              }}>
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                required
                style={{
                  width: '100%', padding: '12px 14px',
                  fontSize: 16,
                  background: 'var(--c-bg)',
                  border: '1.5px solid var(--c-border)',
                  borderRadius: 10,
                  color: 'var(--c-text)',
                  transition: 'border-color 150ms, box-shadow 150ms',
                  marginBottom: 14,
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
              />

              {error && (
                <div style={{
                  background: 'var(--c-danger-light)', color: 'var(--c-danger)',
                  fontSize: 12.5, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                  border: '1px solid rgba(220,38,38,0.15)', lineHeight: 1.4,
                }}>
                  {typeof error === 'string' ? error : error.message || 'Something went wrong.'}
                </div>
              )}

              <button
                id="login-submit"
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  width: '100%', padding: '12px 0',
                  fontSize: 14, fontWeight: 600,
                  background: 'var(--c-accent)', color: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 2px 8px rgba(5,150,105,0.2)',
                  opacity: loading || !email.trim() ? 0.55 : 1,
                  transition: 'opacity 150ms, transform 80ms',
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                }}
                onMouseDown={(e) => { if (!loading && email.trim()) e.target.style.transform = 'scale(0.985)' }}
                onMouseUp={(e) => { e.target.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.target.style.transform = 'scale(1)' }}
              >
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Sending magic link...
                  </span>
                ) : 'Continue with Email'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
