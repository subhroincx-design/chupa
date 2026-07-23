import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../hooks/useSearch'
import { supabase } from '../lib/supabase'
import { sanitizeInput } from '../utils/sanitize'
import Avatar from './Avatar'
import AvatarUpload from './AvatarUpload'
import InstallGuideModal from './InstallGuideModal'
import SupportTicketsModal from './SupportTicketsModal'
import { saveUserBio, fetchUserBio } from '../utils/bioManager'

function AdminBanPanelModal({ onClose, onStartChat }) {
  const { banUser, unbanUser } = useAuth()
  const [bannedList, setBannedList] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'banned'
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = async () => {
    setLoadingUsers(true)
    try {
      // 1. Load banned users
      const { data: bData } = await supabase.from('banned_users').select('*')
      const localBanned = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
      const mergedBanned = new Set([
        ...(bData || []).map(b => b.username),
        ...localBanned
      ])
      setBannedList(Array.from(mergedBanned))

      // 2. Load all registered users who ever joined
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (pData) setAllUsers(pData)
    } catch (err) {
      console.warn('Error loading admin user list:', err)
      const local = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
      setBannedList(local)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    loadData()
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

  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    )
  })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, background: 'var(--c-surface)',
          border: '1px solid var(--c-border)', borderRadius: 22,
          padding: '22px 20px', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>
              👑 Owner Desk & User Directory
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: '2px 0 0' }}>
              All registered users on Chupa • Manage bans & accounts
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex', background: 'var(--c-bg)', borderRadius: 12,
          padding: 3, marginBottom: 14, border: '1px solid var(--c-border)'
        }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 700,
              borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === 'all' ? 'var(--c-surface)' : 'transparent',
              color: activeTab === 'all' ? 'var(--c-text)' : 'var(--c-text-tertiary)',
              boxShadow: activeTab === 'all' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 120ms',
            }}
          >
            👥 All Users ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('banned')}
            style={{
              flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 700,
              borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === 'banned' ? 'var(--c-surface)' : 'transparent',
              color: activeTab === 'banned' ? 'var(--c-danger)' : 'var(--c-text-tertiary)',
              boxShadow: activeTab === 'banned' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 120ms',
            }}
          >
            🚫 Banned ({bannedList.length})
          </button>
        </div>

        {/* Search input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter users by name or username..."
          style={{
            width: '100%', padding: '10px 14px', fontSize: 13.5,
            background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
            borderRadius: 12, color: 'var(--c-text)', outline: 'none', marginBottom: 14,
          }}
        />

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 220 }}>
          {loadingUsers ? (
            <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 24 }}>Loading user directory...</p>
          ) : activeTab === 'all' ? (
            filteredUsers.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 24 }}>No registered users found.</p>
            ) : (
              filteredUsers.map((u) => {
                const isBanned = bannedList.some(h => h.toLowerCase() === u.username?.toLowerCase())
                const isSelf = u.username?.toLowerCase() === 'subhro' || u.name?.toLowerCase() === 'subhro'

                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--c-bg)' }}>
                    <Avatar name={u.name || u.username} url={u.avatar_url} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--c-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name} {isSelf && '👑'}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)' }}>@{u.username}</span>
                    </div>

                    {isSelf ? (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--c-accent)', background: 'var(--c-accent-light)', padding: '3px 8px', borderRadius: 99 }}>
                        OWNER
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={async () => {
                            const newName = window.prompt(`Change name for @${u.username}:`, u.name)
                            if (newName && newName.trim()) {
                              await supabase.from('profiles').update({ name: newName.trim() }).eq('id', u.id)
                              await loadData()
                            }
                          }}
                          title="Edit Display Name"
                          style={{
                            padding: '5px 9px', fontSize: 11.5, fontWeight: 600,
                            background: 'var(--c-surface)', color: 'var(--c-text)',
                            border: '1px solid var(--c-border)', borderRadius: 99, cursor: 'pointer',
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleBanToggle(u.id, u.username)}
                          style={{
                            padding: '5px 10px', fontSize: 11.5, fontWeight: 700,
                            background: isBanned ? 'var(--c-accent)' : 'var(--c-danger)',
                            color: '#fff', border: 'none', borderRadius: 99, cursor: 'pointer',
                          }}
                        >
                          {isBanned ? 'Unban' : '🚫 Ban'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )
          ) : (
            /* Banned list tab */
            bannedList.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 24 }}>No users currently banned.</p>
            ) : (
              bannedList.map((handle) => (
                <div key={handle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: 'var(--c-bg)' }}>
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
            )
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

function FullEditProfileModal({ profile, user, onClose, onRefresh }) {
  const [name, setName] = useState(profile?.name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(() => profile?.bio || localStorage.getItem(`chupa-bio-${profile?.id || user?.id}`) || user?.user_metadata?.bio || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadBio = async () => {
      const uId = profile?.id || user?.id
      if (uId) {
        const b = await fetchUserBio(uId)
        if (b) setBio(b)
      }
    }
    loadBio()
  }, [profile?.id, user?.id])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
      setAvatarFile(f)
      setAvatarPreview(URL.createObjectURL(f))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const cleanName = sanitizeInput(name)
      const cleanUsername = sanitizeInput(username)
      const cleanBio = sanitizeInput(bio)

      if (cleanName && cleanName !== profile?.name) {
        const { data: nRes } = await supabase.rpc('update_name', { p_user_id: profile.id, p_new_name: cleanName })
        if (nRes && !nRes.success) { setError(nRes.error); setSaving(false); return }
      }

      if (cleanUsername && cleanUsername !== profile?.username) {
        const { data: uRes } = await supabase.rpc('update_username', { p_user_id: profile.id, p_new_username: cleanUsername })
        if (uRes && !uRes.success) { setError(uRes.error); setSaving(false); return }
      }

      if (cleanBio !== undefined && cleanBio !== profile?.bio) {
        await saveUserBio(profile.id, cleanBio)
      }

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop().toLowerCase()
        const path = `${profile.id}/avatar.${ext}`
        await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        await supabase.rpc('update_avatar', { p_user_id: profile.id, p_new_url: `${publicUrl}?v=${Date.now()}` })
      }

      await onRefresh()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <form className="fade-in-scale" onSubmit={handleSave} onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 20, padding: '24px 20px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>✏️ Edit Profile</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px', background: 'var(--c-bg)', borderRadius: 14, border: '1px solid var(--c-border)' }}>
          <Avatar name={name || profile?.name} url={avatarPreview} size={52} />
          <label style={{ padding: '8px 14px', fontSize: 12.5, fontWeight: 700, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, color: 'var(--c-text)', cursor: 'pointer' }}>
            📷 Change Photo
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--c-text-secondary)', marginBottom: 4 }}>DISPLAY NAME</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--c-bg)', border: '1.5px solid var(--c-border)', borderRadius: 10, color: 'var(--c-text)', outline: 'none' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--c-text-secondary)', marginBottom: 4 }}>USERNAME (@)</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: 'var(--c-bg)', border: '1.5px solid var(--c-border)', borderRadius: 10, color: 'var(--c-text)', outline: 'none' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--c-text-secondary)', marginBottom: 4 }}>BIO / ABOUT</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write something about yourself..." style={{ width: '100%', minHeight: 70, padding: '10px 12px', fontSize: 13.5, background: 'var(--c-bg)', border: '1.5px solid var(--c-border)', borderRadius: 10, color: 'var(--c-text)', outline: 'none', resize: 'none' }} />
        </div>

        {error && <p style={{ fontSize: 12, color: 'var(--c-danger)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px 0', fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-text-secondary)', border: '1px solid var(--c-border)', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 700, background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Profile'}</button>
        </div>
      </form>
    </div>
  )
}

export default function ProfileMenu() {
  const { user, profile, signOut, refreshProfile, isOwner } = useAuth()
  const [open, setOpen] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
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

  const menuItemStyle = {
    width: '100%', padding: '10px 14px',
    fontSize: 13.5, textAlign: 'left',
    color: 'var(--c-text)', background: 'none',
    cursor: 'pointer', transition: 'background 100ms',
    border: 'none', display: 'flex', alignItems: 'center', gap: 10,
    minHeight: 42, WebkitTapHighlightColor: 'transparent',
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
            width: 235, background: 'var(--c-surface)',
            border: '1px solid var(--c-border)', borderRadius: 16,
            boxShadow: 'var(--shadow-lg)', zIndex: 100, overflowY: 'auto',
            maxHeight: 'calc(100vh - 80px)', WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Profile header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={profile?.name} url={profile?.avatar_url} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.name}
                </p>
                {isOwner && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-accent)', background: 'var(--c-accent-light)', padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>
                    👑 OWNER
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: 0 }}>
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
            <button style={{ ...menuItemStyle, fontWeight: 600 }} onClick={() => { setShowEditProfile(true); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>✏️</span> <span>Edit Profile & Photo</span>
            </button>
            <button style={menuItemStyle} onClick={() => { setShowSupportModal(true); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>🎧</span> <span>Support Tickets</span>
            </button>
            <button style={menuItemStyle} onClick={() => { setShowInstallModal(true); setOpen(false) }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span>📲</span> <span>Install App</span>
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

      {showEditProfile && <FullEditProfileModal profile={profile} user={user} onClose={() => setShowEditProfile(false)} onRefresh={refreshProfile} />}
      {showInstallModal && <InstallGuideModal onClose={() => setShowInstallModal(false)} />}
      {showSettings && <SettingsModal user={user} profile={profile} onClose={() => setShowSettings(false)} />}
      {showAdminPanel && <AdminBanPanelModal onClose={() => setShowAdminPanel(false)} />}
      {showSupportModal && <SupportTicketsModal onClose={() => setShowSupportModal(false)} />}
    </div>
  )
}
