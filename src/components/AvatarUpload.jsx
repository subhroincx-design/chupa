import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

export default function AvatarUpload({ onClose }) {
  const { user, profile, refreshProfile } = useAuth()
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)) {
      setError('Only JPG, PNG, WebP, or GIF')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    setFile(f)
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')

    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Cache-bust so browser shows new image immediately
      const finalUrl = `${publicUrl}?v=${Date.now()}`

      const { data } = await supabase.rpc('update_avatar', {
        p_user_id: user.id,
        p_new_url: finalUrl,
      })

      if (data && !data.success) {
        setError(data.error)
        setUploading(false)
        return
      }

      await refreshProfile()
      onClose()
    } catch (err) {
      setError(err.message || 'Upload failed. Make sure you ran the v2 SQL migration.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setUploading(true)
    setError('')
    try {
      const { data } = await supabase.rpc('update_avatar', {
        p_user_id: user.id,
        p_new_url: '',
      })
      if (data && !data.success) {
        setError(data.error)
        setUploading(false)
        return
      }
      await refreshProfile()
      onClose()
    } catch {
      setError('Failed to remove photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, padding: 28,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 22px' }}>
          Profile Picture
        </h3>

        {/* Preview */}
        <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'center' }}>
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              style={{
                width: 100, height: 100, borderRadius: '50%',
                objectFit: 'cover', border: '3px solid var(--c-accent)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}
            />
          ) : (
            <div style={{ position: 'relative' }}>
              <Avatar name={profile?.name} url={profile?.avatar_url} size={100} />
              {!profile?.avatar_url && (
                <div style={{
                  position: 'absolute', bottom: -4, right: -4,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--c-accent)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--c-surface)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {error && (
          <p className="fade-in" style={{
            fontSize: 12, color: 'var(--c-danger)',
            background: 'var(--c-danger-light)', padding: '8px 12px',
            borderRadius: 'var(--radius-xs)', marginBottom: 14,
          }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 500,
              background: 'var(--c-bg)', border: '1px solid var(--c-border)',
              borderRadius: 'var(--radius-xs)', color: 'var(--c-text)', cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--c-surface-hover)'}
            onMouseLeave={(e) => e.target.style.background = 'var(--c-bg)'}
          >
            {file ? 'Choose Different Photo' : 'Choose Photo'}
          </button>

          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{
                width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600,
                background: 'var(--c-accent)', color: '#fff',
                borderRadius: 'var(--radius-xs)',
                boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
                opacity: uploading ? 0.6 : 1,
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'opacity 150ms',
              }}
            >
              {uploading ? 'Uploading...' : 'Save Photo'}
            </button>
          )}

          {profile?.avatar_url && !file && (
            <button
              onClick={handleRemove}
              disabled={uploading}
              style={{
                width: '100%', padding: '9px 0', fontSize: 13,
                color: 'var(--c-danger)', background: 'none', cursor: 'pointer',
              }}
            >
              Remove current photo
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '9px 0', fontSize: 13,
              color: 'var(--c-text-tertiary)', background: 'none', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
