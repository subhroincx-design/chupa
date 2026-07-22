import { memo } from 'react'

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

const MessageBubble = memo(function MessageBubble({ message, isSender, showDate, dateLabel, isConsecutive }) {
  let borderRadius = isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
  if (isConsecutive && !showDate) {
    borderRadius = isSender ? '18px 4px 4px 18px' : '4px 18px 18px 4px'
  }

  const marginTop = isConsecutive && !showDate ? 2 : 8

  return (
    <>
      {showDate && <DateSeparator label={dateLabel} />}
      <div
        style={{ display: 'flex', justifyContent: isSender ? 'flex-end' : 'flex-start', marginTop }}
      >
        <div style={{
          maxWidth: '75%',
          padding: '8px 12px 6px',
          borderRadius,
          background: isSender ? 'var(--c-accent)' : 'var(--c-surface)',
          border: isSender ? 'none' : '1px solid var(--c-border)',
          boxShadow: isSender ? '0 1px 4px rgba(5,150,105,0.18)' : 'var(--shadow-sm)',
          position: 'relative',
        }}>
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
            gap: 4,
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
          </div>
        </div>
      </div>
    </>
  )
})

export default MessageBubble

export { formatDateLabel }
