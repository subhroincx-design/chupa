import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import VerifyOtp from './pages/VerifyOtp'
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

export default function App() {
  const { user, profile, loading, profileFetched } = useAuth()
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
    if (loading) return

    const path = location.pathname

    if (user && profile) {
      if (path === '/login' || path === '/verify-otp' || path === '/setup' || path === '/') {
        navigate('/dashboard', { replace: true })
      }
    } else if (user && !profile && profileFetched) {
      if (path !== '/setup') {
        navigate('/setup', { replace: true })
      }
    } else if (!user) {
      if (path !== '/login' && path !== '/verify-otp') {
        navigate('/login', { replace: true })
      }
    }
  }, [user, profile, loading, profileFetched, navigate, location.pathname])

  if (loading || (user && !profile && !profileFetched)) return <LoadingScreen />

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
