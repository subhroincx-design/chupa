import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function VerifyOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRefs = useRef([])

  useEffect(() => {
    if (!email) {
      navigate('/login')
      return
    }
    inputRefs.current[0]?.focus()
  }, [email, navigate])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 1)

    const newOtp = [...otp]
    newOtp[index] = cleaned
    setOtp(newOtp)
    setError('')

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (cleaned && index === 5) {
      const token = newOtp.join('')
      if (token.length === 6) {
        verifyToken(token)
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return

    const newOtp = [...otp]
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || ''
    }
    setOtp(newOtp)

    if (pasted.length === 6) {
      verifyToken(pasted)
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }

  const verifyToken = async (token) => {
    setLoading(true)
    setError('')

    // Try type 'email' first, then fallback to 'signup' or 'magiclink'
    const typesToTry = ['email', 'signup', 'magiclink', 'recovery']
    let verified = false
    let lastErrorMsg = ''

    for (const type of typesToTry) {
      try {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type,
        })

        if (!verifyError && data?.session) {
          verified = true
          break
        } else if (verifyError) {
          lastErrorMsg = verifyError.message
        }
      } catch (err) {
        lastErrorMsg = err.message || 'Verification error'
      }
    }

    if (!verified) {
      setError(lastErrorMsg || 'Token has expired or is invalid')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }

    setLoading(false)
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return

    try {
      await supabase.auth.signInWithOtp({ email: email.trim() })
      setResendCooldown(60)
      setError('')
    } catch {
      setError('Failed to resend code')
    }
  }

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 440 }}>
        
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button
            onClick={() => navigate('/login')}
            style={{ fontSize: 13, color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Change email
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Logo size={24} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>Chupa</span>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--radius)', padding: '32px 28px', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 6px' }}>
              Check your inbox
            </h1>
            <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Enter the 6-digit code sent to<br />
              <strong style={{ color: 'var(--c-accent)' }}>{email}</strong>
            </p>
          </div>

          {/* OTP Digit Grid */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                id={`otp-input-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={loading}
                style={{
                  width: 46,
                  height: 54,
                  textAlign: 'center',
                  fontSize: 22,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  background: digit ? 'var(--c-accent-light)' : 'var(--c-bg)',
                  border: `1px solid ${digit ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--c-text)',
                  transition: 'all 150ms ease',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.1)' }}
                onBlur={(e) => { if (!digit) { e.target.style.borderColor = 'var(--c-border)'; e.target.style.boxShadow = 'none' } }}
              />
            ))}
          </div>

          {error && (
            <div className="fade-in" style={{ background: 'var(--c-danger-light)', color: 'var(--c-danger)', fontSize: 12, padding: '10px 14px', borderRadius: 'var(--radius-xs)', marginBottom: 16, textAlign: 'center', border: '1px solid rgba(220,38,38,0.15)', lineHeight: 1.4 }}>
              {error}
              <div style={{ marginTop: 6 }}>
                <button
                  onClick={handleResend}
                  style={{ color: 'var(--c-accent)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', padding: 0, fontSize: 12, cursor: 'pointer' }}
                >
                  Send a new code to email →
                </button>
              </div>
            </div>
          )}

          {loading && (
            <p style={{ fontSize: 12, textAlign: 'center', color: 'var(--c-accent)', fontWeight: 600, marginBottom: 16, animation: 'pulse-dot 1s infinite' }}>
              Verifying code...
            </p>
          )}

          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-xs)', background: 'var(--c-bg)', border: '1px solid var(--c-border)', marginBottom: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              💡 <strong>Or tap the Magic Link</strong> in the email to log in directly without typing the code!
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--c-border)', fontSize: 12 }}>
            <span style={{ color: 'var(--c-text-tertiary)' }}>Didn't receive the email?</span>
            <button
              id="resend-otp"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              style={{
                color: resendCooldown > 0 ? 'var(--c-text-tertiary)' : 'var(--c-accent)',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--c-text-tertiary)', textAlign: 'center', marginTop: 20 }}>
          Tip: Check your Spam or Promotions folder if it's missing.
        </p>
      </div>
    </div>
  )
}
