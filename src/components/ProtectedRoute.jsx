import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, profileLoading } = useAuth()

  if (loading || profileLoading) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/setup" replace />
  }

  return children
}
