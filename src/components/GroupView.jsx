import { useState, useEffect, useRef } from 'react'
import { useGroupMessages } from '../hooks/useGroupMessages'
import { useAuth } from '../context/AuthContext'
import MessageBubble, { formatDateLabel } from './MessageBubble'
import MessageInput from './MessageInput'
import Avatar from './Avatar'
import Logo from './Logo'

function groupMessagesByDate(messages) {
  const groups = []
  let lastDate = null
  let lastSender = null
  let lastTimestamp = null

  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at)
    const dateStr = msgDate.toDateString()
    const showDate = dateStr !== lastDate

    const isConsecutive = !showDate &&
      lastSender === msg.sender_id &&
      lastTimestamp &&
      (msgDate - lastTimestamp < 5 * 60 * 1000)

    groups.push({
      msg,
      showDate,
      dateLabel: showDate ? formatDateLabel(msg.created_at) : null,
      isConsecutive,
    })

    lastDate = dateStr
    lastSender = msg.sender_id
    lastTimestamp = msgDate
  })

  return groups
}

export default function GroupView({ group, onBack, onLeaveGroup }) {
  const { user } = useAuth()
  const { messages, loading, members, sendMessage, deleteMessage } = useGroupMessages(group?.id)
  const [replyingTo, setReplyingTo] = useState(null)
  const [showOptions, setShowOptions] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!messagesEndRef.current) return
    messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
  }, [group?.id])

  useEffect(() => {
    if (!messagesEndRef.current || !messages.length) return
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (!group) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-bg)', gap: 12, padding: 24, textAlign: 'center',
      }}>
        <div style={{
          width: 68, height: 68, borderRadius: 20,
          background: 'linear-gradient(135deg, #059669, #10b981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(5,150,105,0.25)',
        }}>
          <Logo size={40} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>Groups in Chupa</h2>
        <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', margin: 0 }}>
          Select a group or create a new one to chat together
        </p>
      </div>
    )
  }

  const grouped = groupMessagesByDate(messages)

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--c-bg)', overflow: 'hidden',
    }}>
      {/* Group Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        paddingTop: 'calc(10px + var(--safe-top))',
        borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-surface)', flexShrink: 0, position: 'relative',
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-secondary)', marginLeft: -4, marginRight: 2,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}

        <Avatar name={group.name} url={group.avatar_url} size={36} />

        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setShowMembersModal(true)}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.name}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)', margin: 0 }}>
            {members.length} member{members.length !== 1 ? 's' : ''} • tap to view info
          </p>
        </div>

        <button
          onClick={() => setShowOptions(!showOptions)}
          style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-secondary)', cursor: 'pointer' }}
        >⋮</button>

        {showOptions && (
          <div style={{
            position: 'absolute', top: '100%', right: 14, marginTop: 4,
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 100,
            overflow: 'hidden', minWidth: 160,
          }}>
            <button
              onClick={() => { setShowMembersModal(true); setShowOptions(false) }}
              style={{ width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left', color: 'var(--c-text)', background: 'none', cursor: 'pointer' }}
            >
              👥 Group members
            </button>
            <button
              onClick={() => {
                setShowOptions(false)
                if (window.confirm('Leave this group?')) {
                  onLeaveGroup?.(group.id)
                }
              }}
              style={{ width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left', color: 'var(--c-danger)', background: 'none', cursor: 'pointer', borderTop: '1px solid var(--c-border)' }}
            >
              🚪 Leave group
            </button>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 6px', overscrollBehavior: 'contain' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
            {[55, 110, 75, 130].map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
                <div className="skeleton" style={{ height: 38, width: w, borderRadius: 14 }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center', padding: 24 }}>
            <Avatar name={group.name} url={group.avatar_url} size={64} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)', margin: 0 }}>Welcome to {group.name}!</p>
            <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', margin: 0 }}>Send a message or image to start chatting</p>
          </div>
        ) : (
          grouped.map(({ msg, showDate, dateLabel, isConsecutive }) => {
            const isSender = msg.sender_id === user?.id
            return (
              <div key={msg.id}>
                {/* Show sender name for group messages if not sender */}
                {!isSender && !isConsecutive && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-accent)', margin: '8px 0 2px 4px' }}>
                    {msg.sender_name || 'Member'}
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isSender={isSender}
                  showDate={showDate}
                  dateLabel={dateLabel}
                  isConsecutive={isConsecutive}
                  senderName={isSender ? 'You' : msg.sender_name || 'Member'}
                  isDelivered={true}
                  onReply={(m) => setReplyingTo(m)}
                  onDelete={deleteMessage}
                />
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} style={{ height: 4 }} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Members Modal */}
      {showMembersModal && (
        <div
          onClick={() => setShowMembersModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="fade-in-scale"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360, background: 'var(--c-surface)',
              border: '1px solid var(--c-border)', borderRadius: 18,
              padding: '20px', boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>
                Group Members ({members.length})
              </h3>
              <button onClick={() => setShowMembersModal(false)} style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
            </div>
            {group.description && (
              <p style={{ fontSize: 12.5, color: 'var(--c-text-secondary)', marginBottom: 14, background: 'var(--c-bg)', padding: '8px 12px', borderRadius: 8 }}>
                {group.description}
              </p>
            )}
            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map((m) => (
                <div key={m.id || Math.random()} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={m.name} url={m.avatar_url} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text)', display: 'block' }}>{m.name}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)' }}>@{m.username}</span>
                  </div>
                  {m.role === 'admin' && (
                    <span style={{ fontSize: 10.5, color: 'var(--c-accent)', fontWeight: 700, background: 'var(--c-accent-light)', padding: '2px 6px', borderRadius: 99 }}>
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
