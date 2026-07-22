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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-tertiary)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  )
}

const MessageBubble = memo(function MessageBubble({ message, isSender, showDate, dateLabel }) {
  return (
    <>
      {showDate && <DateSeparator label={dateLabel} />}
      <div
        className={isSender ? 'bubble-in-right' : 'bubble-in-left'}
        style={{ display: 'flex', justifyContent: isSender ? 'flex-end' : 'flex-start', marginBottom: 4 }}
      >
        <div style={{
          maxWidth: '72%',
          padding: '9px 13px',
          borderRadius: isSender ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isSender ? 'var(--c-accent)' : 'var(--c-surface)',
          border: isSender ? 'none' : '1px solid var(--c-border)',
          boxShadow: isSender ? '0 2px 6px rgba(5,150,105,0.2)' : 'var(--shadow-sm)',
        }}>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              color: isSender ? '#ffffff' : 'var(--c-text)',
              margin: 0,
            }}
            ref={(el) => { if (el) el.textContent = message.content }}
          />
          <p style={{
            fontSize: 10,
            marginTop: 4,
            color: isSender ? 'rgba(255,255,255,0.5)' : 'var(--c-text-tertiary)',
            textAlign: isSender ? 'right' : 'left',
            margin: '4px 0 0',
          }}>
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    </>
  )
})

export default MessageBubble

export { formatDateLabel }
