import { useState, useRef, useEffect } from 'react'
import { sanitizeMessage } from '../utils/sanitize'

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef(null)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const sanitized = sanitizeMessage(text)
    if (!sanitized || sending) return
    setSending(true)
    const success = await onSend(sanitized)
    if (success !== false) setText('')
    setSending(false)
    // Refocus AFTER React re-render so keyboard stays open on iOS/Android
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const remaining = 2000 - text.length
  const canSend = text.trim().length > 0 && !sending

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      /* Padding: 10px + safe-area-bottom so input clears iPhone home bar */
      padding: '10px 12px',
      paddingBottom: 'calc(10px + var(--safe-bottom))',
      borderTop: '1px solid var(--c-border)',
      background: 'var(--c-surface)',
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          ref={inputRef}
          id="message-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          // ⚠️ Do NOT use disabled here — it blurs the input on mobile and closes the keyboard.
          // Double-send is prevented by the `sending` guard in handleSubmit instead.
          readOnly={false}
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck="true"
          /* font-size 16px prevents iOS auto-zoom on focus */
          style={{
            width: '100%',
            padding: '10px 40px 10px 16px',
            fontSize: 16,
            lineHeight: 1.4,
            background: 'var(--c-bg)',
            border: '1.5px solid var(--c-border)',
            borderRadius: 24,
            color: 'var(--c-text)',
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
  )
}
