import { useEffect, useRef } from 'react'
import { useMessages } from '../hooks/useMessages'
import { useAuth } from '../context/AuthContext'
import MessageBubble, { formatDateLabel } from './MessageBubble'
import MessageInput from './MessageInput'
import Avatar from './Avatar'
import Logo from './Logo'

function groupMessagesByDate(messages) {
  const groups = []
  let lastDate = null
  messages.forEach((msg) => {
    const dateStr = new Date(msg.created_at).toDateString()
    const showDate = dateStr !== lastDate
    groups.push({ msg, showDate, dateLabel: showDate ? formatDateLabel(msg.created_at) : null })
    lastDate = dateStr
  })
  return groups
}

export default function ChatView({ conversation, onBack }) {
  const { user } = useAuth()
  const { messages, loading, sendMessage } = useMessages(conversation?.conversation_id)
  const messagesEndRef = useRef(null)
  const scrollRef = useRef(null)

  // Scroll to bottom — instant on first load, smooth on new messages
  useEffect(() => {
    if (!messagesEndRef.current) return
    messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
  }, [conversation?.conversation_id])

  useEffect(() => {
    if (!messagesEndRef.current || !messages.length) return
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  /* ── Empty / welcome state ── */
  if (!conversation) {
    return (
      <div style={{
        height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-bg)', gap: 12, padding: 24,
        textAlign: 'center',
      }}>
        <div style={{
          width: 68, height: 68, borderRadius: 20,
          background: 'linear-gradient(135deg, #059669, #10b981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(5,150,105,0.25)',
        }}>
          <Logo size={40} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Chupa
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', margin: 0 }}>
            Select a chat or search for someone
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {['⚡ Instant', '🔒 Private', '✨ Minimal'].map((f) => (
            <span key={f} style={{ fontSize: 12, color: 'var(--c-text-tertiary)', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 99, padding: '4px 10px' }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const grouped = groupMessagesByDate(messages)

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--c-bg)',
      /* Prevent body scroll on iOS when chat is open */
      overflow: 'hidden',
    }}>
      {/* ── Chat header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        paddingTop: 'calc(10px + var(--safe-top))',
        borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        flexShrink: 0,
      }}>
        {onBack && (
          <button
            id="chat-back"
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-secondary)',
              marginLeft: -4, marginRight: 2,
              background: 'none', border: 'none',
              transition: 'background 100ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
        <Avatar name={conversation.other_user_name} url={conversation.other_user_avatar} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {conversation.other_user_name}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: 0, lineHeight: 1 }}>
            @{conversation.other_user_username}
          </p>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 14px 6px',
          /* Avoid content hidden under input on some browsers */
          overscrollBehavior: 'contain',
        }}
      >
        {loading ? (
          /* Skeleton bubbles */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
            {[55, 110, 75, 130, 60, 90].map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: i % 3 !== 1 ? 'flex-end' : 'flex-start' }}>
                <div className="skeleton" style={{ height: 38, width: w, borderRadius: 14 }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 10, textAlign: 'center', padding: 24,
          }}>
            <Avatar name={conversation.other_user_name} url={conversation.other_user_avatar} size={64} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 3px' }}>
                {conversation.other_user_name}
              </p>
              <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', margin: 0 }}>
                Say hi to start the conversation 👋
              </p>
            </div>
          </div>
        ) : (
          grouped.map(({ msg, showDate, dateLabel }) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSender={msg.sender_id === user?.id}
              showDate={showDate}
              dateLabel={dateLabel}
            />
          ))
        )}
        <div ref={messagesEndRef} style={{ height: 4 }} />
      </div>

      {/* ── Input ── */}
      <MessageInput onSend={sendMessage} />
    </div>
  )
}
