import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // 1. Check existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      }
    })

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session || event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSessionReady(true)
      }
    })

    // 3. Guarantee form is ready within 1 second so user is never stuck
    const timer = setTimeout(() => {
      setSessionReady(true)
    }, 1000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  const inputStyle = (hasError) => ({
    width: '100%', padding: '12px 14px', fontSize: 16,
    background: 'var(--c-bg)',
    border: `1.5px solid ${hasError ? 'var(--c-danger)' : 'var(--c-border)'}`,
    borderRadius: 10, color: 'var(--c-text)', outline: 'none',
    transition: 'border-color 150ms, box-shadow 150ms',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) setError(updateErr.message)
      else setDone(true)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--c-bg)', minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 18,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            boxShadow: '0 8px 24px rgba(5,150,105,0.22)', marginBottom: 14,
          }}>
            <Logo size={36} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.03em', margin: '0 0 4px' }}>Chupa</h1>
        </div>

        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 18, padding: '28px 24px', boxShadow: 'var(--shadow-md)',
        }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--c-accent-light)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 8px' }}>Password Updated!</h2>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 24px', lineHeight: 1.5 }}>
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%', padding: '12px 0', fontSize: 14.5, fontWeight: 600,
                  background: 'var(--c-accent)', color: '#fff', borderRadius: 10, cursor: 'pointer',
                }}
              >
                Sign In →
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Set New Password
              </h2>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
                Choose a strong new password for your account.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="reset-password" style={{ display: 'block', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-secondary)', marginBottom: 7 }}>
                    New Password
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder="min 6 characters"
                    autoComplete="new-password"
                    autoFocus
                    style={inputStyle(error)}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)' }}
                    onBlur={(e) => { e.target.style.borderColor = error ? 'var(--c-danger)' : 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="reset-confirm" style={{ display: 'block', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-secondary)', marginBottom: 7 }}>
                    Confirm Password
                  </label>
                  <input
                    id="reset-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError('') }}
                    placeholder="repeat new password"
                    autoComplete="new-password"
                    style={inputStyle(error)}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.08)' }}
                    onBlur={(e) => { e.target.style.borderColor = error ? 'var(--c-danger)' : 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {error && (
                  <div style={{
                    background: 'var(--c-danger-light)', color: 'var(--c-danger)',
                    fontSize: 12.5, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                    border: '1px solid rgba(220,38,38,0.15)',
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  style={{
                    width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600,
                    background: 'var(--c-accent)', color: '#fff', borderRadius: 10,
                    opacity: loading || !sessionReady ? 0.65 : 1,
                    cursor: loading || !sessionReady ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Updating...' : !sessionReady ? 'Verifying link...' : 'Update Password →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
