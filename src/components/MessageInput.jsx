import { useState, useRef, useEffect } from 'react'
import { sanitizeMessage } from '../utils/sanitize'

export default function MessageInput({ onSend, disabled, replyingTo, onCancelReply, onTyping, members }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState('')
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [mentionState, setMentionState] = useState({ active: false, query: '', index: 0, cursor: 0 })
  const inputRef = useRef(null)
  const fileRef = useRef(null)

  const filteredMembers = mentionState.active && members
    ? members.filter(m => m.username?.toLowerCase().includes(mentionState.query.toLowerCase()) || m.name?.toLowerCase().includes(mentionState.query.toLowerCase()))
    : []

  useEffect(() => {
    if (!window.visualViewport) return
    const handle = () => {
      setIsKeyboardOpen(window.innerHeight - window.visualViewport.height > 120)
    }
    window.visualViewport.addEventListener('resize', handle)
    return () => window.visualViewport.removeEventListener('resize', handle)
  }, [])

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus()
  }, [replyingTo])

  const handleImagePick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setImageError('')
    if (f.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)) {
      setImageError('Only JPEG, PNG, WEBP or GIF')
      return
    }
    setImageFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageError('')
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const sanitized = text.trim() ? sanitizeMessage(text) : ''
    if ((!sanitized && !imageFile) || sending || disabled) return

    setSending(true)

    let finalContent = sanitized
    if (replyingTo && sanitized) {
      const quoteAuthor = replyingTo.senderName || 'Message'
      const truncated = replyingTo.message.content
        ? (replyingTo.message.content.length > 60
          ? replyingTo.message.content.slice(0, 60) + '...'
          : replyingTo.message.content)
        : '[Image]'
      finalContent = `> ${quoteAuthor}: "${truncated}"\n${sanitized}`
    }

    const success = await onSend(finalContent || null, imageFile)
    if (success !== false) {
      setText('')
      clearImage()
      onCancelReply?.()
    }
    setSending(false)
  }

  const insertMention = (username) => {
    const textBeforeMention = text.slice(0, mentionState.cursor - mentionState.query.length - 1)
    const textAfterMention = text.slice(mentionState.cursor)
    const newText = textBeforeMention + `@${username} ` + textAfterMention
    setText(newText)
    setMentionState({ active: false, query: '', index: 0, cursor: 0 })
    
    // Focus and set cursor position after a slight delay
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const newCursorPos = textBeforeMention.length + username.length + 2
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 10)
  }

  const handleKeyDown = (e) => {
    if (mentionState.active && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionState(prev => ({ ...prev, index: (prev.index + 1) % filteredMembers.length }))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionState(prev => ({ ...prev, index: (prev.index - 1 + filteredMembers.length) % filteredMembers.length }))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        insertMention(filteredMembers[mentionState.index].username)
        return
      }
      if (e.key === 'Escape') {
        setMentionState(prev => ({ ...prev, active: false }))
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    setText(val.slice(0, 2000))
    onTyping?.()

    if (members && members.length > 0) {
      const cursor = e.target.selectionStart
      const textBeforeCursor = val.slice(0, cursor)
      const match = textBeforeCursor.match(/(?:^|\s)@(\w*)$/)
      
      if (match) {
        setMentionState(prev => ({ active: true, query: match[1], index: 0, cursor: cursor }))
      } else {
        setMentionState(prev => ({ ...prev, active: false }))
      }
    }
  }

  const remaining = 2000 - text.length
  const canSend = (text.trim().length > 0 || !!imageFile) && !sending && !disabled

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', position: 'relative',
      borderTop: '1px solid var(--c-border)',
      background: 'var(--c-surface)',
      flexShrink: 0,
    }}>
      {/* Mention Popup */}
      {mentionState.active && filteredMembers.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 14, right: 14, marginBottom: 8,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 12, boxShadow: 'var(--shadow-lg)',
          maxHeight: 160, overflowY: 'auto', zIndex: 100,
          display: 'flex', flexDirection: 'column', padding: '4px 0'
        }}>
          {filteredMembers.map((m, i) => (
            <button
              key={m.id}
              onClick={(e) => { e.preventDefault(); insertMention(m.username) }}
              onMouseDown={(e) => e.preventDefault()} // prevent blur
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                background: i === mentionState.index ? 'var(--c-surface-hover)' : 'transparent',
                border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--c-bg)', overflow: 'hidden', flexShrink: 0 }}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                ) : (
                  <div style={{width:'100%',height:'100%',background:'var(--c-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:'bold'}}>
                    {m.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{m.username}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px 7px',
          background: 'var(--c-bg)',
          borderBottom: '1px solid var(--c-border)',
        }}>
          <div style={{
            flex: 1, minWidth: 0,
            borderLeft: '3px solid var(--c-accent)',
            paddingLeft: 10,
            borderRadius: '0 6px 6px 0',
          }}>
            <span style={{
              fontWeight: 700, color: 'var(--c-accent)',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5,
              marginBottom: 1,
            }}>
              <span style={{ fontSize: 10 }}>↩</span>
              {replyingTo.senderName || 'user'}
            </span>
            <span style={{
              color: 'var(--c-text-secondary)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
              fontSize: 12.5, lineHeight: 1.3,
            }}>
              {replyingTo.message?.image_url && !replyingTo.message?.content ? '📷 Photo' : (replyingTo.message?.content || '[Image]')}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              fontSize: 12, color: 'var(--c-text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >✕</button>
        </div>
      )}

      {/* Image preview strip */}
      {(imagePreview || imageError) && (
        <div style={{
          padding: '8px 14px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {imagePreview && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={imagePreview}
                alt="preview"
                style={{
                  height: 64, width: 64, objectFit: 'cover',
                  borderRadius: 10,
                  border: '1.5px solid var(--c-accent)',
                }}
              />
              <button
                onClick={clearImage}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--c-danger)', color: '#fff',
                  fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: '1.5px solid var(--c-surface)',
                  fontWeight: 700,
                }}
              >✕</button>
            </div>
          )}
          {imageError && (
            <span style={{ fontSize: 12, color: 'var(--c-danger)', fontWeight: 500 }}>{imageError}</span>
          )}
        </div>
      )}

      {/* Main input row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 10px',
        paddingBottom: isKeyboardOpen ? '10px' : 'calc(10px + var(--safe-bottom))',
      }}>
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImagePick}
          style={{ display: 'none' }}
          disabled={disabled}
        />

        {/* Image attach button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="Attach image"
          style={{
            width: 38, height: 38,
            borderRadius: '50%',
            background: imageFile ? 'var(--c-accent-light)' : 'var(--c-surface-hover)',
            border: `1.5px solid ${imageFile ? 'var(--c-accent)' : 'var(--c-border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 150ms',
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke={imageFile ? 'var(--c-accent)' : 'var(--c-text-tertiary)'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>

        {/* Text input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            id="message-input"
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'You have blocked this user' : 'Message...'}
            disabled={disabled}
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck="true"
            style={{
              width: '100%',
              padding: '10px 38px 10px 16px',
              fontSize: 16,
              lineHeight: 1.4,
              background: 'var(--c-bg)',
              border: '1.5px solid var(--c-border)',
              borderRadius: 24,
              color: 'var(--c-text)',
              caretColor: 'var(--c-accent)',
              transition: 'border-color 150ms, box-shadow 150ms',
              opacity: disabled ? 0.5 : 1,
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--c-accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.1)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--c-border)'; e.target.style.boxShadow = 'none' }}
          />
          {remaining <= 200 && (
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 10.5, fontWeight: 600,
              color: remaining <= 50 ? 'var(--c-danger)' : 'var(--c-text-tertiary)',
              pointerEvents: 'none',
            }}>
              {remaining}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          id="send-message"
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            width: 42, height: 42, borderRadius: '50%',
            background: canSend ? 'var(--c-accent)' : 'var(--c-surface-hover)',
            border: `1.5px solid ${canSend ? 'transparent' : 'var(--c-border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 180ms, transform 80ms',
          }}
          onMouseDown={(e) => { if (canSend) e.currentTarget.style.transform = 'scale(0.88)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={(e) => { if (canSend) e.currentTarget.style.transform = 'scale(0.88)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {sending ? (
            <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={canSend ? '#fff' : 'var(--c-text-tertiary)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
