import { memo, useState, useRef, useEffect } from 'react'
import Avatar from './Avatar'

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

function renderTextWithLinks(text, isSender) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  const parts = text.split(urlRegex)

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('www.') ? `https://${part}` : part
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: isSender ? '#ffffff' : 'var(--c-accent)',
            textDecoration: 'underline',
            fontWeight: 600,
            wordBreak: 'break-all',
          }}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

function parseQuoteContent(content) {
  if (!content || typeof content !== 'string' || !content.startsWith('> ')) {
    return { quote: null, mainText: content || '' }
  }
  const firstLineEnd = content.indexOf('\n')
  if (firstLineEnd === -1) {
    return { quote: null, mainText: content }
  }

  const quoteLine = content.slice(2, firstLineEnd)
  const mainText = content.slice(firstLineEnd + 1)

  const colonIdx = quoteLine.indexOf(':')
  if (colonIdx !== -1) {
    const author = quoteLine.slice(0, colonIdx).trim()
    let text = quoteLine.slice(colonIdx + 1).trim()
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1)
    }
    return { quote: { author, text }, mainText }
  }

  return { quote: { author: 'Reply', text: quoteLine }, mainText }
}

// Full-screen image lightbox
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt="Full size"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '100%',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          objectFit: 'contain',
          cursor: 'default',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >✕</button>
    </div>
  )
}

const MessageBubble = memo(function MessageBubble({
  message, isSender, showDate, dateLabel, isConsecutive, onReply, onDelete, senderName, isDelivered,
  senderAvatar, showAvatar, onOpenProfile, showSenderHeader, isOwner
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const bubbleRef = useRef(null)
  const menuRef = useRef(null)

  const hasImage = !!message.image_url
  const hasText = !!message.content

  const handleToggleMenu = (e) => {
    e.stopPropagation()
    if (!showMenu && bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect()
      setOpenUpward(rect.bottom > window.innerHeight - 180)
    }
    setShowMenu(!showMenu)
  }

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [showMenu])

  const handleCopy = () => {
    if (message.content) navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
    setShowMenu(false)
  }

  let borderRadius = isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
  if (isConsecutive && !showDate) {
    borderRadius = isSender ? '18px 4px 4px 18px' : '4px 18px 18px 4px'
  }
  const marginTop = isConsecutive && !showDate ? 2 : 8

  const { quote, mainText } = parseQuoteContent(message.content)

  return (
    <>
      {lightbox && <Lightbox src={message.image_url} onClose={() => setLightbox(false)} />}
      {showDate && <DateSeparator label={dateLabel} />}

      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: isSender ? 'flex-end' : 'flex-start',
          gap: 6,
          marginTop,
          position: 'relative',
          zIndex: showMenu ? 100 : 1,
        }}
      >
        {/* Member Avatar for Group Chats */}
        {!isSender && (
          <div style={{ width: 30, height: 30, flexShrink: 0, marginBottom: 2 }}>
            {showAvatar ? (
              <div
                onClick={() => onOpenProfile?.({ id: message.sender_id, name: senderName, avatar_url: senderAvatar })}
                style={{ cursor: 'pointer' }}
                title={senderName}
              >
                <Avatar name={senderName} url={senderAvatar} size={30} />
              </div>
            ) : (
              <div style={{ width: 30, height: 30 }} />
            )}
          </div>
        )}

        {/* Sender Quick Actions (Hover-only or when Menu is open) */}
        {isSender && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2, flexShrink: 0,
            opacity: (isHovered || showMenu) ? 1 : 0,
            pointerEvents: (isHovered || showMenu) ? 'auto' : 'none',
            transition: 'opacity 150ms ease-in-out',
          }}>
            <button
              onClick={() => onReply?.({ message, senderName })}
              title="Reply to message"
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              ↩
            </button>
            <button
              onClick={handleToggleMenu}
              title="Options"
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              ⋮
            </button>
          </div>
        )}

        {/* Bubble Container */}
        <div
          ref={bubbleRef}
          onClick={() => onReply?.({ message, senderName })}
          title="Click to reply"
          style={{
            maxWidth: hasImage ? '72%' : '75%',
            borderRadius,
            background: isSender ? 'var(--c-accent)' : 'var(--c-surface)',
            border: isSender ? 'none' : '1px solid var(--c-border)',
            boxShadow: isSender ? '0 1px 4px rgba(5,150,105,0.18)' : 'var(--shadow-sm)',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {/* Group Sender Header */}
          {!isSender && showSenderHeader && (
            <div
              onClick={() => onOpenProfile?.({ id: message.sender_id, name: senderName, avatar_url: senderAvatar })}
              style={{
                padding: '6px 12px 0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-accent)' }}>
                {senderName}
              </span>
              {isOwner && (
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-accent)', background: 'var(--c-accent-light)', padding: '1px 5px', borderRadius: 99 }}>
                  👑 OWNER
                </span>
              )}
            </div>
          )}

          {/* Quoted Reply Card Header */}
          {quote && (
            <div
              onClick={(e) => {
                e.stopPropagation()
                onReply?.({ message, senderName })
              }}
              style={{
                margin: '6px 8px 3px',
                padding: '7px 10px',
                borderRadius: 10,
                background: isSender ? 'rgba(255, 255, 255, 0.22)' : 'rgba(5, 150, 105, 0.08)',
                borderLeft: `3.5px solid ${isSender ? '#ffffff' : 'var(--c-accent)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                color: isSender ? '#ffffff' : 'var(--c-accent)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                letterSpacing: '0.01em',
              }}>
                <span style={{ fontSize: 10 }}>↩</span> {quote.author}
              </div>
              <div style={{
                fontSize: 12.5,
                lineHeight: 1.3,
                color: isSender ? 'rgba(255, 255, 255, 0.92)' : 'var(--c-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 500,
              }}>
                {quote.text}
              </div>
            </div>
          )}

          {/* Context menu */}
          {showMenu && (
            <div ref={menuRef} style={{
              position: 'absolute',
              top: openUpward ? 'auto' : '100%',
              bottom: openUpward ? '100%' : 'auto',
              right: isSender ? 0 : 'auto',
              left: isSender ? 'auto' : 0,
              marginTop: openUpward ? 0 : 6,
              marginBottom: openUpward ? 6 : 0,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 12, boxShadow: 'var(--shadow-lg)',
              zIndex: 200, padding: '4px 0', minWidth: 160, overflow: 'hidden',
            }}>
              <button
                onClick={() => { onReply?.({ message, senderName }); setShowMenu(false) }}
                style={{
                  width: 'calc(100% - 12px)',
                  margin: '4px 6px',
                  padding: '9px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 3px 10px rgba(5, 150, 105, 0.3)',
                }}
              >
                <span style={{ fontSize: 14 }}>↩</span> Reply to message
              </button>
              {hasImage && (
                <button onClick={() => { setLightbox(true); setShowMenu(false) }}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left', color: 'var(--c-text)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
                  🔍 View image
                </button>
              )}
              {isSender && onDelete && (
                <button onClick={() => { onDelete(message.id); setShowMenu(false) }}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left', color: 'var(--c-danger)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, borderTop: '1px solid var(--c-border)' }}>
                  🗑 Delete for everyone
                </button>
              )}
            </div>
          )}

          {/* Image */}
          {hasImage && (
            <div
              onClick={() => setLightbox(true)}
              style={{ cursor: 'zoom-in', position: 'relative', lineHeight: 0 }}
            >
              {!imgLoaded && (
                <div className="skeleton" style={{ width: '100%', height: 160, minWidth: 180 }} />
              )}
              <img
                src={message.image_url}
                alt="Sent image"
                onLoad={() => setImgLoaded(true)}
                style={{
                  maxWidth: '100%',
                  maxHeight: 260,
                  minWidth: 120,
                  objectFit: 'cover',
                  display: imgLoaded ? 'block' : 'none',
                  borderRadius: hasText ? '0' : borderRadius,
                }}
              />
            </div>
          )}

          {/* Text content */}
          {hasText && (
            <div style={{ padding: '8px 12px 0' }}>
              <p style={{
                fontSize: 14.5, lineHeight: 1.45,
                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                color: isSender ? '#ffffff' : 'var(--c-text)',
                margin: 0,
              }}>
                {renderTextWithLinks(mainText, isSender)}
              </p>
            </div>
          )}

          {/* Time + ticks */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
            padding: hasText ? '3px 10px 6px' : '4px 8px 6px',
          }}>
            <span style={{ fontSize: 10, color: isSender ? 'rgba(255,255,255,0.65)' : 'var(--c-text-tertiary)', fontWeight: 500, userSelect: 'none' }}>
              {formatTime(message.created_at)}
            </span>
            {isSender && (
              <span style={{ fontSize: 10, color: isDelivered ? '#ffffff' : 'rgba(255,255,255,0.65)', letterSpacing: -1.5, fontWeight: 700, userSelect: 'none' }}>
                {isDelivered ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>

        {/* Recipient Quick Actions (Hover-only or when Menu is open) */}
        {!isSender && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2, flexShrink: 0,
            opacity: (isHovered || showMenu) ? 1 : 0,
            pointerEvents: (isHovered || showMenu) ? 'auto' : 'none',
            transition: 'opacity 150ms ease-in-out',
          }}>
            <button
              onClick={() => onReply?.({ message, senderName })}
              title="Reply to message"
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              ↩
            </button>
            <button
              onClick={handleToggleMenu}
              title="Options"
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              ⋮
            </button>
          </div>
        )}
      </div>
    </>
  )
})

export default MessageBubble
export { formatDateLabel }
