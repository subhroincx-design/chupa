import { useState, useRef } from 'react'
import Avatar from './Avatar'

export default function CreateGroupModal({ conversations, onCreate, onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  const toggleUser = (conv) => {
    if (selectedUsers.some(u => u.other_user_id === conv.other_user_id)) {
      setSelectedUsers(prev => prev.filter(u => u.other_user_id !== conv.other_user_id))
    } else {
      setSelectedUsers(prev => [...prev, conv])
    }
  }

  const handleAvatarPick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return
    setAvatarFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setErrorMsg('')

    try {
      const group = await onCreate({
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedUsers.map(u => u.other_user_id),
        avatarFile,
      })

      setSubmitting(false)
      if (group) {
        onClose()
      } else {
        setErrorMsg('Failed to create group. Please check SQL patch is applied in Supabase.')
      }
    } catch (err) {
      setSubmitting(false)
      setErrorMsg(err?.message || 'Failed to create group.')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440,
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 20, padding: '24px 20px',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', margin: 0, letterSpacing: '-0.02em' }}>
            Create New Group
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {errorMsg && (
            <div style={{
              padding: '8px 12px', marginBottom: 14, borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--c-danger)',
              color: 'var(--c-danger)', fontSize: 12.5, fontWeight: 500,
            }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {/* Avatar + Group Name */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ position: 'relative', background: 'none', padding: 0, border: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Group avatar" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--c-accent)' }} />
              ) : (
                <Avatar name={name || 'G'} size={56} />
              )}
              <div style={{
                position: 'absolute', bottom: -2, right: -2, width: 22, height: 22,
                borderRadius: '50%', background: 'var(--c-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--c-surface)', color: '#fff', fontSize: 11,
              }}>📷</div>
            </button>

            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder="Group Name *"
                required
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 15, fontWeight: 600,
                  background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
                  borderRadius: 10, color: 'var(--c-text)', outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--c-accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--c-border)'}
              />
            </div>
          </div>

          {/* Description */}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 120))}
            placeholder="Description (optional)"
            style={{
              width: '100%', padding: '9px 14px', fontSize: 13.5,
              background: 'var(--c-bg)', border: '1px solid var(--c-border)',
              borderRadius: 10, color: 'var(--c-text)', outline: 'none', marginBottom: 16,
            }}
          />

          {/* Select Members */}
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-secondary)', marginBottom: 8 }}>
            Add Members ({selectedUsers.length})
          </label>

          <div style={{
            flex: 1, overflowY: 'auto', border: '1px solid var(--c-border)',
            borderRadius: 12, background: 'var(--c-bg)', padding: '6px 0', minHeight: 140, maxHeight: 200, marginBottom: 18,
          }}>
            {conversations.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 16, margin: 0 }}>
                No active chats yet. Search users to start chatting first!
              </p>
            ) : (
              conversations.map((conv) => {
                const selected = selectedUsers.some(u => u.other_user_id === conv.other_user_id)
                return (
                  <div
                    key={conv.other_user_id}
                    onClick={() => toggleUser(conv)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                      cursor: 'pointer', background: selected ? 'var(--c-accent-light)' : 'transparent',
                      transition: 'background 120ms',
                    }}
                  >
                    <Avatar name={conv.other_user_name} url={conv.other_user_avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.other_user_name}
                      </p>
                      <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: 0 }}>
                        @{conv.other_user_username}
                      </p>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: `2px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      background: selected ? 'var(--c-accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 12, fontWeight: 700,
                    }}>
                      {selected && '✓'}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600,
                border: '1px solid var(--c-border)', borderRadius: 10,
                background: 'var(--c-surface)', color: 'var(--c-text-secondary)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              style={{
                flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600,
                background: 'var(--c-accent)', color: '#fff', borderRadius: 10,
                opacity: !name.trim() || submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating...' : 'Create Group →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
