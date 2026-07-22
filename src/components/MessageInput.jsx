import { useState, useRef, useEffect } from 'react'
import { sanitizeMessage } from '../utils/sanitize'

export default function MessageInput({ onSend, disabled, replyingTo, onCancelReply, onTyping }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const inputRef = useRef(null)

  // Detect virtual software keyboard open/close state via Visual Viewport API
  useEffect(() => {
    if (!window.visualViewport) return

    const handleResize = () => {
      // If visualViewport height is significantly smaller than window.innerHeight, keyboard is active
      const keyboardActive = window.innerHeight - window.visualViewport.height > 120
      setIsKeyboardOpen(keyboardActive)
    }

    window.visualViewport.addEventListener('resize', handleResize)
    return () => window.visualViewport.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus()
    }
  }, [replyingTo])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const sanitized = sanitizeMessage(text)
    if (!sanitized || sending) return

    setSending(true)

    // Prepend quoted context if replying
    let finalContent = sanitized
    if (replyingTo) {
      const quoteAuthor = replyingTo.senderName || 'Message'
      const truncated = replyingTo.message.content.length > 60
        ? replyingTo.message.content.slice(0, 60) + '...'
        : replyingTo.message.content
      finalContent = `> ${quoteAuthor}: "${truncated}"\n${sanitized}`
    }

    const success = await onSend(finalContent)
    if (success !== false) {
      setText('')
      onCancelReply?.()
    }
    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e) => {
    setText(e.target.value.slice(0, 2000))
    onTyping?.()
  }

  const remaining = 2000 - text.length
  const canSend = text.trim().length > 0 && !sending

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderTop: '1px solid var(--c-border)',
      background: 'var(--c-surface)',
      flexShrink: 0,
    }}>
      {/* Replying quote bar */}
      {replyingTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px 6px',
          background: 'var(--c-bg)',
          borderBottom: '1px solid var(--c-border)',
          fontSize: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0, borderLeft: '3px solid var(--c-accent)', paddingLeft: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--c-accent)', display: 'block', fontSize: 11 }}>
              Replying to {replyingTo.senderName || 'user'}
            </span>
            <span style={{ color: 'var(--c-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontSize: 12 }}>
              {replyingTo.message.content}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            aria-label="Cancel reply"
            style={{
              padding: 4,
              fontSize: 14,
              color: 'var(--c-text-tertiary)',
              cursor: 'pointer',
              marginLeft: 8,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input container */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        paddingBottom: isKeyboardOpen ? '10px' : 'calc(10px + var(--safe-bottom))',
        background: 'var(--c-surface)',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            id="message-input"
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            readOnly={false}
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck="true"
            style={{
              width: '100%',
              padding: '10px 40px 10px 16px',
              fontSize: 16,
              lineHeight: 1.4,
              background: 'var(--c-bg)',
              border: '1.5px solid var(--c-border)',
              borderRadius: 24,
              color: 'var(--c-text)',
              caretColor: 'var(--c-accent)',
              transition: 'border-color 150ms, box-shadow 150ms',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--c-accent)'
              e.target.style.boxShadow = '0 0 0 3px rgba(5,150,105,0.1)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--c-border)'
              e.target.style.boxShadow = 'none'
            }}
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
            transition: 'background 180ms, transform 80ms, border-color 180ms',
          }}
          onMouseDown={(e) => { if (canSend) e.currentTarget.style.transform = 'scale(0.88)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={(e) => { if (canSend) e.currentTarget.style.transform = 'scale(0.88)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {sending ? (
            <span style={{
              width: 15, height: 15,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }} />
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={canSend ? '#fff' : 'var(--c-text-tertiary)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
