import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'

export default function UserProfileModal({ user, onClose, onStartChat }) {
  const { isUserOnline } = useAuth()
  const [profileData, setProfileData] = useState(user)
  const [loading, setLoading] = useState(!user?.bio && !!user?.id)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    const loadFullProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (data) {
          setProfileData(prev => ({ ...prev, ...data }))
        }
      } catch (err) {
        console.warn('Error loading user profile details:', err)
      } finally {
        setLoading(false)
      }
    }
    loadFullProfile()
  }, [user?.id])

  if (!user) return null

  const isOnline = isUserOnline ? isUserOnline(user.id || profileData?.id) : false
  const isSubhro = (profileData?.username || user?.username)?.toLowerCase() === 'subhro' || (profileData?.name || user?.name)?.toLowerCase() === 'subhro'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: 'var(--c-surface)',
          border: '1px solid var(--c-border)', borderRadius: 22,
          padding: '24px 20px', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--c-bg)', border: '1px solid var(--c-border)',
            fontSize: 16, color: 'var(--c-text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Avatar with click to zoom */}
        <div
          onClick={() => (profileData?.avatar_url || user?.avatar_url) && setLightbox(true)}
          style={{ position: 'relative', cursor: (profileData?.avatar_url || user?.avatar_url) ? 'zoom-in' : 'default', marginBottom: 14 }}
        >
          <Avatar
            name={profileData?.name || user?.name || user?.username}
            url={profileData?.avatar_url || user?.avatar_url}
            size={84}
          />
          {isOnline && (
            <span
              title="Online now"
              style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 14, height: 14, borderRadius: '50%',
                background: 'var(--c-accent)', border: '2.5px solid var(--c-surface)',
              }}
            />
          )}
        </div>

        {/* Display Name & Owner Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%', marginBottom: 2 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profileData?.name || user?.name}
          </h2>
          {isSubhro && (
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-accent)', background: 'var(--c-accent-light)', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>
              👑 OWNER
            </span>
          )}
        </div>

        {/* Username */}
        <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', margin: '0 0 14px', fontWeight: 500 }}>
          @{profileData?.username || user?.username}
        </p>

        {/* Bio Section */}
        <div style={{
          width: '100%', background: 'var(--c-bg)', border: '1px solid var(--c-border)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 18, textAlign: 'left',
        }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-secondary)', marginBottom: 4 }}>
            About / Bio
          </span>
          <p style={{ fontSize: 13.5, color: profileData?.bio ? 'var(--c-text)' : 'var(--c-text-tertiary)', margin: 0, lineHeight: 1.5, fontStyle: profileData?.bio ? 'normal' : 'italic' }}>
            {loading ? 'Loading profile...' : (profileData?.bio || 'No bio added yet.')}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {onStartChat && (
            <button
              onClick={() => {
                onStartChat(profileData || user)
                onClose()
              }}
              style={{
                flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 700,
                background: 'var(--c-accent)', color: '#fff', border: 'none',
                borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <span>💬</span> <span>Message</span>
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: onStartChat ? 'none' : 1, padding: '12px 16px', fontSize: 14, fontWeight: 600,
              background: 'var(--c-bg)', color: 'var(--c-text-secondary)', border: '1px solid var(--c-border)',
              borderRadius: 12, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        {/* Image Lightbox */}
        {lightbox && (profileData?.avatar_url || user?.avatar_url) && (
          <div
            onClick={() => setLightbox(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out',
            }}
          >
            <img
              src={profileData?.avatar_url || user?.avatar_url}
              alt="Avatar Large"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 16, objectFit: 'contain' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
