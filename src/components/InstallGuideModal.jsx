import { useState, useEffect } from 'react'
import Logo from './Logo'

export default function InstallGuideModal({ onClose }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setInstalled(true)
      }
      setDeferredPrompt(null)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px 20px', background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          padding: '24px 20px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 18,
            background: 'linear-gradient(135deg, #059669, #10b981)',
            boxShadow: '0 8px 24px rgba(5,150,105,0.22)',
            marginBottom: 12,
          }}>
            <Logo size={36} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Install Chupa App
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0 }}>
            Get full-screen mobile app experience with zero lag
          </p>
        </div>

        {/* If native prompt available */}
        {deferredPrompt && !installed && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={handleNativeInstall}
              style={{
                width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 700,
                background: 'var(--c-accent)', color: '#fff', borderRadius: 12,
                boxShadow: '0 4px 14px rgba(5,150,105,0.3)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span>📲</span> <span>Install Chupa Now</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>
                or follow manual steps
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
            </div>
          </div>
        )}

        {/* Step by step guide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>

          {/* Step 1 */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--c-bg)', padding: '14px', borderRadius: 12, border: '1px solid var(--c-border)' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--c-accent)', color: '#fff',
              fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>1</div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 3px' }}>
                Tap Chrome / Browser Menu (⋮)
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Click the 3 dots menu at the top-right corner of your browser.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--c-bg)', padding: '14px', borderRadius: 12, border: '1px solid var(--c-border)' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--c-accent)', color: '#fff',
              fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>2</div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 3px' }}>
                Select "Add to Home screen" or "Install app"
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Tap <strong>Add to Home screen</strong> or <strong>Install app</strong> / <strong>Create shortcut</strong>.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--c-bg)', padding: '14px', borderRadius: 12, border: '1px solid var(--c-border)' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--c-accent)', color: '#fff',
              fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>3</div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 3px' }}>
                Confirm & Launch
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Tap <strong>Install</strong> or <strong>Add</strong> to add Chupa icon directly to your home screen!
              </p>
            </div>
          </div>

        </div>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 600,
            border: '1px solid var(--c-border)', borderRadius: 10,
            background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer',
          }}
        >
          Got It, Close
        </button>
      </div>
    </div>
  )
}
