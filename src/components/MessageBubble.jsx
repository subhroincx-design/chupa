import { memo, useState, useRef, useEffect, useCallback } from 'react'
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 12px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      <span style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--c-text-tertiary)',
        whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '2px 10px', background: 'var(--c-bg)', borderRadius: 99,
        border: '1px solid var(--c-border)',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  )
}

function renderTextWithLinks(text, isSender) {
  if (!text) return null
  const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|@\w+)/gi
  const parts = text.split(regex)
  return parts.map((part, index) => {
    if (!part) return null
    if (part.startsWith('http') || part.startsWith('www.')) {
      const href = part.startsWith('www.') ? `https://${part}` : part
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: isSender ? 'rgba(255,255,255,0.9)' : 'var(--c-accent)',
            textDecoration: 'underline',
            fontWeight: 600,
            wordBreak: 'break-all',
          }}
        >
          {part}
        </a>
      )
    }
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span
          key={index}
          style={{
            color: isSender ? '#fff' : 'var(--c-accent)',
            fontWeight: 700,
            backgroundColor: isSender ? 'rgba(255,255,255,0.25)' : 'rgba(16,185,129,0.12)',
            padding: '2px 5px',
            borderRadius: 6,
          }}
        >
          {part}
        </span>
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
  if (firstLineEnd === -1) return { quote: null, mainText: content }

  const quoteLine = content.slice(2, firstLineEnd)
  const mainText = content.slice(firstLineEnd + 1)
  const colonIdx = quoteLine.indexOf(':')
  if (colonIdx !== -1) {
    const author = quoteLine.slice(0, colonIdx).trim()
    let text = quoteLine.slice(colonIdx + 1).trim()
    if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1)
    return { quote: { author, text }, mainText }
  }
  return { quote: { author: 'Reply', text: quoteLine }, mainText }
}

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
        background: 'rgba(0,0,0,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt="Full size"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '100%',
          borderRadius: 14,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          objectFit: 'contain',
          cursor: 'default',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 18, right: 18,
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.22)',
          color: '#fff', fontSize: 17,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}
      >✕</button>
    </div>
  )
}

const MessageBubble = memo(function MessageBubble({
  message, isSender, showDate, dateLabel, isConsecutive, onReply, onDelete,
  senderName, isDelivered, senderAvatar, showAvatar, onOpenProfile,
  showSenderHeader, isOwner,
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Swipe-to-reply state
  const [dragX, setDragX] = useState(0)
  const isDraggingRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const isThresholdMetRef = useRef(false)
  const didSwipeRef = useRef(false)

  const bubbleRef = useRef(null)
  const menuRef = useRef(null)

  const hasImage = !!message.image_url
  const hasText = !!message.content
  const { quote, mainText } = parseQuoteContent(message.content)

  // --- Swipe handlers (touch only, won't interfere with text selection on desktop) ---
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    isThresholdMetRef.current = false
    didSwipeRef.current = false
    isDraggingRef.current = true
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!isDraggingRef.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)

    // Ignore vertical scrolling
    if (deltaY > Math.abs(deltaX) && dragX === 0) return

    if (deltaX > 4) {
      didSwipeRef.current = true
      const resistantX = Math.min(deltaX * 0.42, 68)
      setDragX(resistantX)
      if (resistantX >= 46 && !isThresholdMetRef.current) {
        isThresholdMetRef.current = true
        if (navigator.vibrate) navigator.vibrate(12)
      }
    }
  }, [dragX])

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false
    if (isThresholdMetRef.current) {
      onReply?.({ message, senderName })
    }
    setDragX(0)
    isThresholdMetRef.current = false
  }, [message, senderName, onReply])

  // Menu toggle
  const handleToggleMenu = useCallback((e) => {
    e.stopPropagation()
    if (!showMenu && bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect()
      setOpenUpward(rect.bottom > window.innerHeight - 200)
    }
    setShowMenu(prev => !prev)
  }, [showMenu])

  // Close menu on outside click
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

  // Border radius & spacing
  let borderRadius = isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
  if (isConsecutive && !showDate) {
    borderRadius = isSender ? '18px 4px 4px 18px' : '4px 18px 18px 4px'
  }
  const marginTop = isConsecutive && !showDate ? 2 : 8

  return (
    <>
      {lightbox && <Lightbox src={message.image_url} onClose={() => setLightbox(false)} />}
      {showDate && <DateSeparator label={dateLabel} />}

      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); }}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: isSender ? 'flex-end' : 'flex-start',
          gap: 4,
          marginTop,
          position: 'relative',
          zIndex: showMenu ? 100 : 1,
        }}
      >
        {/* Group avatar (left side) */}
        {!isSender && showAvatar && (
          <div style={{ width: 28, height: 28, flexShrink: 0, marginBottom: 2 }}>
            <div
              onClick={() => onOpenProfile?.({ id: message.sender_id, name: senderName, avatar_url: senderAvatar })}
              style={{ cursor: 'pointer' }}
            >
              <Avatar name={senderName} url={senderAvatar} size={28} />
            </div>
          </div>
        )}

        {/* --- SENDER: hover action bar (LEFT of bubble) --- */}
        {isSender && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
            opacity: (isHovered || showMenu) ? 1 : 0,
            pointerEvents: (isHovered || showMenu) ? 'auto' : 'none',
            transition: 'opacity 140ms',
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onReply?.({ message, senderName }) }}
              title="Reply"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                color: 'var(--c-accent)', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
            >↩</button>
            <button
              onClick={handleToggleMenu}
              title="Options"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                color: 'var(--c-text-secondary)', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
            >⋮</button>
          </div>
        )}

        {/* --- Swipe reply indicator badge --- */}
        {dragX > 4 && (
          <div style={{
            position: 'absolute',
            [isSender ? 'left' : 'right']: isSender ? 'auto' : 'auto',
            left: !isSender ? -34 : 'auto',
            right: isSender ? -34 : 'auto',
            top: '50%',
            transform: `translateY(-50%) scale(${Math.min(dragX / 42, 1.08)})`,
            opacity: Math.min(dragX / 28, 1),
            width: 28, height: 28, borderRadius: '50%',
            background: dragX >= 46 ? 'var(--c-accent)' : 'var(--c-surface)',
            border: `1.5px solid var(--c-accent)`,
            color: dragX >= 46 ? '#fff' : 'var(--c-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800,
            boxShadow: dragX >= 46 ? '0 4px 14px rgba(5,150,105,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
            pointerEvents: 'none', zIndex: 10,
            transition: 'background 100ms, color 100ms, box-shadow 100ms',
          }}>
            ↩
          </div>
        )}

        {/* --- Bubble --- */}
        <div
          ref={bubbleRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            maxWidth: hasImage ? '70%' : '74%',
            borderRadius,
            background: isSender ? 'var(--c-accent)' : 'var(--c-surface)',
            border: isSender ? 'none' : '1px solid var(--c-border)',
            boxShadow: isSender
              ? '0 2px 8px rgba(5,150,105,0.22)'
              : '0 1px 4px rgba(0,0,0,0.06)',
            position: 'relative',
            transform: `translateX(${dragX}px)`,
            transition: isDraggingRef.current ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.25)',
            touchAction: 'pan-y',
            userSelect: 'text',
          }}
        >
          {/* Group sender label */}
          {!isSender && showSenderHeader && (
            <div
              onClick={() => onOpenProfile?.({ id: message.sender_id, name: senderName, avatar_url: senderAvatar })}
              style={{
                padding: '7px 12px 0',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-accent)' }}>{senderName}</span>
              {isOwner && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: 'var(--c-accent)',
                  background: 'var(--c-accent-light)', padding: '1px 5px', borderRadius: 99,
                }}>👑 OWNER</span>
              )}
            </div>
          )}

          {/* Quote preview card */}
          {quote && (
            <div style={{
              margin: '7px 8px 2px',
              padding: '7px 10px',
              borderRadius: 9,
              background: isSender ? 'rgba(255,255,255,0.18)' : 'rgba(5,150,105,0.07)',
              borderLeft: `3px solid ${isSender ? 'rgba(255,255,255,0.7)' : 'var(--c-accent)'}`,
              display: 'flex', flexDirection: 'column', gap: 2,
              pointerEvents: 'none',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: isSender ? 'rgba(255,255,255,0.95)' : 'var(--c-accent)',
                letterSpacing: '0.01em',
              }}>
                {quote.author}
              </span>
              <span style={{
                fontSize: 12.5, lineHeight: 1.3,
                color: isSender ? 'rgba(255,255,255,0.82)' : 'var(--c-text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontWeight: 400,
              }}>
                {quote.text}
              </span>
            </div>
          )}

          {/* Context menu */}
          {showMenu && (
            <div ref={menuRef} style={{
              position: 'absolute',
              top: openUpward ? 'auto' : 'calc(100% + 6px)',
              bottom: openUpward ? 'calc(100% + 6px)' : 'auto',
              right: isSender ? 0 : 'auto',
              left: isSender ? 'auto' : 0,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
              zIndex: 200, padding: '6px', minWidth: 180, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {/* Reply button - prominent green */}
              <button
                onClick={(e) => { e.stopPropagation(); onReply?.({ message, senderName }); setShowMenu(false) }}
                style={{
                  padding: '10px 14px',
                  fontSize: 13.5, fontWeight: 700,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none', borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 9,
                  boxShadow: '0 2px 8px rgba(5,150,105,0.28)',
                }}
              >
                <span style={{ fontSize: 15 }}>↩</span> Reply
              </button>
              {hasImage && (
                <button
                  onClick={(e) => { e.stopPropagation(); setLightbox(true); setShowMenu(false) }}
                  style={{
                    padding: '9px 14px', fontSize: 13, textAlign: 'left',
                    color: 'var(--c-text)', background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                    borderRadius: 8,
                  }}
                >
                  🔍 View image
                </button>
              )}
              {isSender && onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(message.id); setShowMenu(false) }}
                  style={{
                    padding: '9px 14px', fontSize: 13, textAlign: 'left',
                    color: 'var(--c-danger)', background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                    borderRadius: 8, borderTop: '1px solid var(--c-border)', marginTop: 2,
                  }}
                >
                  🗑 Delete for everyone
                </button>
              )}
            </div>
          )}

          {/* Image */}
          {hasImage && (
            <div
              onClick={(e) => { e.stopPropagation(); setLightbox(true) }}
              style={{ cursor: 'zoom-in', position: 'relative', lineHeight: 0 }}
            >
              {!imgLoaded && (
                <div className="skeleton" style={{ width: '100%', height: 160, minWidth: 180 }} />
              )}
              <img
                src={message.image_url}
                alt="Sent"
                onLoad={() => setImgLoaded(true)}
                style={{
                  maxWidth: '100%', maxHeight: 260, minWidth: 120,
                  objectFit: 'cover',
                  display: imgLoaded ? 'block' : 'none',
                  borderRadius: hasText ? 0 : borderRadius,
                }}
              />
            </div>
          )}

          {/* Text */}
          {hasText && (
            <div style={{ padding: quote ? '4px 12px 0' : '8px 12px 0' }}>
              <p style={{
                fontSize: 14.5, lineHeight: 1.5,
                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                color: isSender ? '#ffffff' : 'var(--c-text)',
                margin: 0,
              }}>
                {renderTextWithLinks(mainText, isSender)}
              </p>
            </div>
          )}

          {/* Timestamp + read receipt */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
            padding: hasText ? '2px 10px 6px' : '4px 8px 6px',
          }}>
            <span style={{
              fontSize: 10,
              color: isSender ? 'rgba(255,255,255,0.6)' : 'var(--c-text-tertiary)',
              fontWeight: 500, userSelect: 'none',
            }}>
              {formatTime(message.created_at)}
            </span>
            {isSender && (
              <span style={{
                fontSize: 10,
                color: isDelivered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
                letterSpacing: -1.5, fontWeight: 700, userSelect: 'none',
              }}>
                {isDelivered ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>

        {/* --- RECIPIENT: hover action bar (RIGHT of bubble) --- */}
        {!isSender && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
            opacity: (isHovered || showMenu) ? 1 : 0,
            pointerEvents: (isHovered || showMenu) ? 'auto' : 'none',
            transition: 'opacity 140ms',
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onReply?.({ message, senderName }) }}
              title="Reply"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                color: 'var(--c-accent)', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
            >↩</button>
            <button
              onClick={handleToggleMenu}
              title="Options"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                color: 'var(--c-text-secondary)', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
            >⋮</button>
          </div>
        )}
      </div>
    </>
  )
})

export default MessageBubble
export { formatDateLabel }
