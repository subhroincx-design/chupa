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

      <div className="fade-in" style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            boxShadow: '0 8px 24px rgba(5,150,105,0.22)',
            marginBottom: 16,
          }}>
            <Logo size={38} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.035em', margin: '0 0 6px', lineHeight: 1.1 }}>
            Chupa
          </h1>
          <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', margin: 0 }}>
            Distraction-free messaging
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
          {sent ? (
            /* ── Sent state ── */
            <div className="fade-in" style={{ textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'var(--c-accent-light)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Check your inbox
              </h2>
              <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                We sent a magic link to<br />
                <strong style={{ color: 'var(--c-accent)' }}>{email}</strong>
              </p>
              <div style={{
                padding: '12px 16px',
                borderRadius: 10, background: 'var(--c-bg)',
                border: '1px solid var(--c-border)', marginBottom: 20,
                textAlign: 'left',
              }}>
                <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.55 }}>
                  📬 Open the email and tap <strong>"Sign In to Chupa"</strong> — you'll be logged in instantly, no password needed!
                </p>
              </div>
              <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', margin: '0 0 16px' }}>
                Check Spam / Promotions if it doesn't appear.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                style={{
                  width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 500,
                  background: 'var(--c-surface-hover)',
                  color: 'var(--c-text)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 10, cursor: 'pointer',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-border)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* ── Email form ── */
            <form onSubmit={handleSubmit}>
              <label style={{
                display: 'block', fontSize: 11.5, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--c-text-secondary)', marginBottom: 8,
              }}>
                Email address
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
                  width: '100%', padding: '13px 16px',
                  fontSize: 16,
                  background: 'var(--c-bg)',
                  border: '1.5px solid var(--c-border)',
                  borderRadius: 10,
                  color: 'var(--c-text)',
                  transition: 'border-color 150ms, box-shadow 150ms',
                  marginBottom: 14,
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
              />

              {error && (
                <div className="fade-in" style={{
                  background: 'var(--c-danger-light)', color: 'var(--c-danger)',
                  fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14,
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
                  width: '100%', padding: '13px 0',
                  fontSize: 15, fontWeight: 600,
                  background: 'var(--c-accent)', color: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 3px 10px rgba(5,150,105,0.22)',
                  opacity: loading || !email.trim() ? 0.55 : 1,
                  transition: 'opacity 150ms, transform 80ms',
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                }}
                onMouseDown={(e) => { if (!loading && email.trim()) e.target.style.transform = 'scale(0.98)' }}
                onMouseUp={(e) => { e.target.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.target.style.transform = 'scale(1)' }}
                onTouchStart={(e) => { if (!loading && email.trim()) e.currentTarget.style.transform = 'scale(0.98)' }}
                onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Sending link...
                  </span>
                ) : 'Send Magic Link →'}
              </button>

              <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', textAlign: 'center', marginTop: 14, lineHeight: 1.4 }}>
                No password. We'll send a secure sign-in link to your inbox.
              </p>
            </form>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', textAlign: 'center', marginTop: 24 }}>
          Fast · Minimal · Private
        </p>
      </div>
    </div>
  )
}
