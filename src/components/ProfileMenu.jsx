import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../hooks/useSearch'
import { supabase } from '../lib/supabase'
import { sanitizeInput } from '../utils/sanitize'
import Avatar from './Avatar'
import AvatarUpload from './AvatarUpload'
import InstallGuideModal from './InstallGuideModal'

function AdminBanPanelModal({ onClose }) {
  const { banUser, unbanUser } = useAuth()
  const { query, results, searching, search } = useSearch()
  const [bannedList, setBannedList] = useState([])

  const loadBannedUsers = async () => {
    try {
      const { data } = await supabase.from('banned_users').select('*')
      const local = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
      const merged = new Set([
        ...(data || []).map(b => b.username),
        ...local
      ])
      setBannedList(Array.from(merged))
    } catch {
      const local = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
      setBannedList(local)
    }
  }

  useEffect(() => {
    loadBannedUsers()
  }, [])

  const handleBanToggle = async (userId, username) => {
    const isCurrentlyBanned = bannedList.some(h => h.toLowerCase() === username.toLowerCase())
    if (isCurrentlyBanned) {
      await unbanUser(userId, username)
      setBannedList(prev => prev.filter(h => h.toLowerCase() !== username.toLowerCase()))
    } else {
      await banUser(userId, username)
      setBannedList(prev => [...prev, username])
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--c-surface)',
          border: '1px solid var(--c-border)', borderRadius: 20,
          padding: '22px 20px', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>
              👑 Owner & Admin Panel
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: '2px 0 0' }}>
              Ban / Unban users • Suspended accounts are locked out instantly
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search user to ban or unban..."
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14,
            background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
            borderRadius: 12, color: 'var(--c-text)', outline: 'none', marginBottom: 14,
          }}
        />

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}>
          {query.trim() ? (
            searching ? (
              <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 20 }}>Searching...</p>
            ) : results.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 20 }}>No users found</p>
            ) : (
              results.map((u) => {
                const isBanned = bannedList.some(h => h.toLowerCase() === u.username.toLowerCase())
                const isSelf = u.username.toLowerCase() === 'subhro'

                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--c-bg)' }}>
                    <Avatar name={u.name} url={u.avatar_url} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name} {u.username.toLowerCase() === 'subhro' && '👑'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>@{u.username}</span>
                    </div>

                    {isSelf ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-accent)', background: 'var(--c-accent-light)', padding: '3px 8px', borderRadius: 99 }}>
                        Owner
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBanToggle(u.id, u.username)}
                        style={{
                          padding: '6px 14px', fontSize: 12, fontWeight: 700,
                          background: isBanned ? 'var(--c-accent)' : 'var(--c-danger)',
                          color: '#fff', border: 'none', borderRadius: 99, cursor: 'pointer',
                        }}
                      >
                        {isBanned ? 'Unban' : '🚫 Ban'}
                      </button>
                    )}
                  </div>
                )
              })
            )
          ) : (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-danger)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Banned Users ({bannedList.length})
              </p>
              {bannedList.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 20 }}>No users currently banned.</p>
              ) : (
                bannedList.map((handle) => (
                  <div key={handle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: 'var(--c-bg)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={handle} size={32} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text)' }}>@{handle}</span>
                    </div>
                    <button
                      onClick={() => handleBanToggle(null, handle)}
                      style={{ padding: '5px 12px', fontSize: 12, fontWeight: 700, background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 99, cursor: 'pointer' }}
                    >
                      Unban
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EditModal({ title, value, onSave, onClose, maxLength, info }) {
  const [input, setInput] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const clean = sanitizeInput(input)
    if (!clean) return
    setSaving(true)
    setError('')
    const result = await onSave(clean)
    if (result?.error) { setError(result.error); setSaving(false) }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px 20px', background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, padding: '24px 20px',
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 16, boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 16px' }}>{title}</h3>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, maxLength || 50))}
          autoFocus
          style={{
            width: '100%', padding: '12px 14px', fontSize: 16,
            background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
            borderRadius: 10, color: 'var(--c-text)', marginBottom: 6,
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)' }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--c-border)' }}
        />
        {info && <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: '0 0 8px' }}>{info}</p>}
        {error && <p style={{ fontSize: 12, color: 'var(--c-danger)', margin: '0 0 8px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 0', fontSize: 14,
              border: '1px solid var(--c-border)', borderRadius: 10,
              color: 'var(--c-text-secondary)', background: 'var(--c-surface)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !input.trim()}
            style={{
              flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600,
              background: 'var(--c-accent)', color: '#fff', borderRadius: 10,
              opacity: saving || !input.trim() ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsModal({ user, profile, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, padding: '24px 20px',
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 18, boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>⚙️ Account Settings</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Linked Email Box */}
          <div style={{ background: 'var(--c-bg)', padding: '14px', borderRadius: 12, border: '1px solid var(--c-border)' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-secondary)', marginBottom: 4 }}>
              Linked Recovery Email
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', wordBreak: 'break-all' }}>
              {user?.email || profile?.email || 'No email attached'}
            </span>
            <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: '4px 0 0' }}>
              Used to reset your password if you ever forget it.
            </p>
          </div>

          {/* Profile details */}
          <div style={{ background: 'var(--c-bg)', padding: '14px', borderRadius: 12, border: '1px solid var(--c-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Display Name</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{profile?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Username</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-accent)' }}>@{profile?.username}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600,
            background: 'var(--c-accent)', color: '#fff', borderRadius: 10,
            marginTop: 18, border: 'none', cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

export default function ProfileMenu() {
  const { user, profile, signOut, refreshProfile, isOwner } = useAuth()
  const [open, setOpen] = useState(false)
  const [editField, setEditField] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showAvatarUpload, setShowAvatarUpload] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [copiedHandle, setCopiedHandle] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const handleCopyHandle = () => {
    if (profile?.username) {
      navigator.clipboard.writeText(`@${profile.username}`)
      setCopiedHandle(true)
      setTimeout(() => setCopiedHandle(false), 1500)
    }
  }

  const handleThemeToggle = () => {
    const html = document.documentElement
    const isDark = html.classList.contains('dark')
    html.classList.toggle('dark', !isDark)
    localStorage.setItem('chupa-theme', isDark ? 'light' : 'dark')
    setOpen(false)
  }

  const handleSaveName = async (v) => {
    const { data } = await supabase.rpc('update_name', { p_user_id: profile.id, p_new_name: v })
    if (data && !data.success) return { error: data.error }
    await refreshProfile(); setEditField(null); setOpen(false); return {}
  }

  const handleSaveUsername = async (v) => {
    const { data } = await supabase.rpc('update_username', { p_user_id: profile.id, p_new_username: v })
    if (data && !data.success) return { error: data.error }
    await refreshProfile(); setEditField(null); setOpen(false); return {}
  }

  const menuItemStyle = {
    width: '100%', padding: '11px 14px',
    fontSize: 13.5, textAlign: 'left',
    color: 'var(--c-text)', background: 'none',
    cursor: 'pointer', transition: 'background 100ms',
    border: 'none', display: 'flex', alignItems: 'center', gap: 10,
    minHeight: 44, WebkitTapHighlightColor: 'transparent',
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        id="profile-menu-trigger"
        onClick={() => setOpen(!open)}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `2px solid ${open ? 'var(--c-accent)' : 'var(--c-border)'}`,
          background: 'var(--c-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', padding: 0, cursor: 'pointer',
          transition: 'border-color 150ms', flexShrink: 0,
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.borderColor = 'var(--c-accent)' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = 'var(--c-border)' }}
      >
        <Avatar name={profile?.name} url={profile?.avatar_url} size={32} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 8,
            width: 230, background: 'var(--c-surface)',
            border: '1px solid var(--c-border)', borderRadius: 14,
            boxShadow: 'var(--shadow-lg)', zIndex: 100, overflow: 'hidden',
          }}
        >
          {/* Profile header */}
          <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={profile?.name} url={profile?.avatar_url} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.name}
                </p>
                {isOwner && (
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--c-accent)', background: 'var(--c-accent-light)', padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>
                    👑 OWNER
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', margin: 0 }}>
                @{profile?.username}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '4px 0' }}>
            {isOwner && (
              <button style={{ ...menuItemStyle, color: 'var(--c-accent)', fontWeight: 700 }} onClick={() => { setShowAdminPanel(true); setOpen(false) }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-accent-light)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                <span>👑</span> <span>Admin & Ban Panel</span>
              </button>
            )}
            <button style={menuItemStyle} onClick={() => { setShowInstallModal(true); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>📲</span> <span>Install Chupa App</span>
            </button>
            <button style={menuItemStyle} onClick={() => { setShowSettings(true); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>⚙️</span> <span>Settings & Email</span>
            </button>
            <button style={menuItemStyle} onClick={handleCopyHandle}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>🔗</span> <span>{copiedHandle ? '✓ Handle copied!' : 'Copy handle'}</span>
            </button>
            <button style={menuItemStyle} onClick={() => { setShowAvatarUpload(true); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>📷</span> <span>Change photo</span>
            </button>
            <button id="edit-name-btn" style={menuItemStyle} onClick={() => { setEditField('name'); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>✏️</span> <span>Edit name</span>
            </button>
            <button id="edit-username-btn" style={menuItemStyle} onClick={() => { setEditField('username'); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>@</span> <span>Edit username</span>
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--c-border)', padding: '4px 0' }}>
            <button id="theme-toggle" style={menuItemStyle} onClick={handleThemeToggle}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>{document.documentElement.classList.contains('dark') ? '☀️' : '🌙'}</span>
              <span>{document.documentElement.classList.contains('dark') ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--c-border)', padding: '4px 0' }}>
            <button id="sign-out-btn"
              style={{ ...menuItemStyle, color: 'var(--c-danger)' }}
              onClick={() => { signOut(); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-danger-light)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>🚪</span> <span>Sign out</span>
            </button>
          </div>
        </div>
      )}

      {showInstallModal && <InstallGuideModal onClose={() => setShowInstallModal(false)} />}
      {showSettings && <SettingsModal user={user} profile={profile} onClose={() => setShowSettings(false)} />}
      {showAvatarUpload && <AvatarUpload onClose={() => setShowAvatarUpload(false)} />}
      {showAdminPanel && <AdminBanPanelModal onClose={() => setShowAdminPanel(false)} />}
      {editField === 'name' && (
        <EditModal title="Edit name" value={profile?.name} maxLength={50} info="Can be changed once every 12 hours" onSave={handleSaveName} onClose={() => setEditField(null)} />
      )}
      {editField === 'username' && (
        <EditModal title="Edit username" value={profile?.username} maxLength={20} info="Once every 7 days. Letters, numbers, underscores." onSave={handleSaveUsername} onClose={() => setEditField(null)} />
      )}
    </div>
  )
}
