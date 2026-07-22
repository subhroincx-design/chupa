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
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--c-bg, #0A0A0E)',
          color: 'var(--c-text, #ffffff)',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, marginBottom: 16,
          }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-tertiary, #9CA3AF)', margin: '0 0 20px', maxWidth: 320, lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred. Tap below to reload.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--c-accent, #059669)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            Reload Chupa
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
