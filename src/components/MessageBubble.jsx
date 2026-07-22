import { memo, useState, useRef, useEffect } from 'react'

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function DateSeparator({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  )
}

const MessageBubble = memo(function MessageBubble({
  message, isSender, showDate, dateLabel, isConsecutive, onReply, onDelete, senderName, isDelivered,
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [showMenu])

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
    setShowMenu(false)
  }

  let borderRadius = isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
  if (isConsecutive && !showDate) {
    borderRadius = isSender ? '18px 4px 4px 18px' : '4px 18px 18px 4px'
  }

  const marginTop = isConsecutive && !showDate ? 2 : 8

  return (
    <>
      {showDate && <DateSeparator label={dateLabel} />}
      <div
        style={{
          display: 'flex',
          justifyContent: isSender ? 'flex-end' : 'flex-start',
          marginTop,
          position: 'relative',
        }}
      >
        <div
          style={{
            maxWidth: '75%',
            padding: '8px 12px 6px',
            borderRadius,
            background: isSender ? 'var(--c-accent)' : 'var(--c-surface)',
            border: isSender ? 'none' : '1px solid var(--c-border)',
            boxShadow: isSender ? '0 1px 4px rgba(5,150,105,0.18)' : 'var(--shadow-sm)',
            position: 'relative',
          }}
        >
          {/* Action trigger button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Message options"
            style={{
              position: 'absolute',
              top: 4,
              right: isSender ? 'auto' : -24,
              left: isSender ? -24 : 'auto',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              cursor: 'pointer',
              opacity: showMenu ? 1 : 0.4,
              transition: 'opacity 120ms',
            }}
          >
            ⋮
          </button>

          {/* Context menu */}
          {showMenu && (
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                top: '100%',
                right: isSender ? 0 : 'auto',
                left: isSender ? 'auto' : 0,
                marginTop: 4,
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-md)',
                zIndex: 50,
                padding: '4px 0',
                minWidth: 150,
              }}
            >
              <button
                onClick={() => { onReply?.({ message, senderName }); setShowMenu(false) }}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 12.5, textAlign: 'left',
                  color: 'var(--c-text)', background: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                ↩ Reply
              </button>
              <button
                onClick={handleCopy}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 12.5, textAlign: 'left',
                  color: 'var(--c-text)', background: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy text'}
              </button>
              {isSender && onDelete && (
                <button
                  onClick={() => { onDelete(message.id); setShowMenu(false) }}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: 12.5, textAlign: 'left',
                    color: 'var(--c-danger)', background: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderTop: '1px solid var(--c-border)', marginTop: 2, paddingTop: 6,
                  }}
                >
                  🗑 Delete for everyone
                </button>
              )}
            </div>
          )}

          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.45,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              color: isSender ? '#ffffff' : 'var(--c-text)',
              margin: 0,
            }}
            ref={(el) => { if (el) el.textContent = message.content }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            marginTop: 3,
          }}>
            <span style={{
              fontSize: 10,
              color: isSender ? 'rgba(255,255,255,0.65)' : 'var(--c-text-tertiary)',
              fontWeight: 500,
              userSelect: 'none',
            }}>
              {formatTime(message.created_at)}
            </span>
            {isSender && (
              <span style={{
                fontSize: 10,
                color: isDelivered ? '#ffffff' : 'rgba(255,255,255,0.65)',
                letterSpacing: -1.5,
                fontWeight: 700,
                userSelect: 'none',
              }}>
                {isDelivered ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
})

export default MessageBubble

export { formatDateLabel }
