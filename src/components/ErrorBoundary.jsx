import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--c-bg, #0B0F19)',
          color: 'var(--c-text, #ffffff)',
          padding: '24px 20px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background aura glow */}
          <div style={{
            position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 320, height: 320, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(11, 15, 25, 0) 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            width: '100%', maxWidth: 360,
            background: 'var(--c-surface, #111827)',
            border: '1px solid var(--c-border, rgba(255, 255, 255, 0.08))',
            borderRadius: 24,
            padding: '32px 24px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            zIndex: 10,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.35))',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 18,
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
            }}>
              ⚡
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text, #F9FAFB)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              App Refreshed
            </h2>
            <p style={{ fontSize: 13, color: 'var(--c-text-secondary, #9CA3AF)', margin: '0 0 20px', lineHeight: 1.5, maxWidth: 300 }}>
              {this.state.error?.message || 'An update or session change occurred. Tap below to reload Chupa.'}
            </p>

            <button
              onClick={this.handleReload}
              style={{
                width: '100%',
                padding: '13px 0',
                fontSize: 14.5,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
                transition: 'transform 120ms, box-shadow 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              🔄 Reload Chupa
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
