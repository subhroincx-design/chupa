import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Logo from './components/Logo'

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--c-bg)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: 'linear-gradient(135deg, #059669, #10b981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(5,150,105,0.25)',
          animation: 'pulse-dot 1.5s ease-in-out infinite',
        }}>
          <Logo size={36} />
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--c-accent)',
                display: 'inline-block',
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BannedScreen() {
  const { signOut, profile, user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--c-bg)', color: 'var(--c-text)', padding: 24, textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.15)', border: '2px solid var(--c-danger)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 20,
      }}>
        🚫
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: 'var(--c-danger)' }}>
        Account Suspended
      </h1>
      <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', maxWidth: 360, lineHeight: 1.6, margin: '0 0 10px' }}>
        Your account (<strong style={{ color: 'var(--c-text)' }}>@{profile?.username || user?.user_metadata?.username || 'user'}</strong>) has been locked out by the platform Owner.
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--c-text-tertiary)', maxWidth: 320, margin: '0 0 24px' }}>
        You cannot access messages or groups while suspended. Contact platform owner @subhro to request access.
      </p>
      <button
        onClick={handleSignOut}
        style={{
          padding: '11px 24px', fontSize: 14, fontWeight: 600,
          background: 'var(--c-danger)', color: '#fff', border: 'none',
          borderRadius: 10, cursor: 'pointer',
        }}
      >
        Sign Out
      </button>
    </div>
  )
}

const PUBLIC_ROUTES = ['/', '/login', '/register', '/reset-password', '/verify-otp']

export default function App() {
  const { user, profile, loading, sessionChecked, profileFetched, isBanned } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Initialize theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chupa-theme')
    const html = document.documentElement
    if (saved === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [])

  // Smart Auto-redirect based on auth state
  useEffect(() => {
    if (loading || !sessionChecked || isBanned) return

    const path = location.pathname

    if (path === '/reset-password') return

    if (user && profile) {
      if (path === '/' || path === '/login' || path === '/register' || path === '/verify-otp') {
        navigate('/dashboard', { replace: true })
      }
    } else if (!user) {
      if (path !== '/' && !PUBLIC_ROUTES.includes(path)) {
        navigate('/login', { replace: true })
      }
    }
  }, [user, profile, loading, sessionChecked, profileFetched, isBanned, navigate, location.pathname])

  if (isBanned) return <BannedScreen />
  if (loading || (user && !profile && !profileFetched)) return <LoadingScreen />

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/setup"
          element={user ? <Setup /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
