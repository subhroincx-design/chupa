import { useState, useEffect, useRef, useCallback } from 'react'
import { useMessages } from '../hooks/useMessages'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
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

export default function ChatView({ conversation, onBack, onDeleteChat }) {
  const { user, isUserOnline } = useAuth()
  const { messages, loading, sendMessage, deleteMessage } = useMessages(conversation?.conversation_id)
  const [replyingTo, setReplyingTo] = useState(null)
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const messagesEndRef = useRef(null)
  const scrollRef = useRef(null)
  const typingTimer = useRef(null)
  const channelRef = useRef(null)

  const isOtherOnline = isUserOnline(conversation?.other_user_id)

  // Block user state stored in localStorage
  const [isBlocked, setIsBlocked] = useState(() => {
    try {
      const blocked = JSON.parse(localStorage.getItem('chupa-blocked-users') || '[]')
      return conversation ? blocked.includes(conversation.other_user_id) : false
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!conversation) return
    try {
      const blocked = JSON.parse(localStorage.getItem('chupa-blocked-users') || '[]')
      setIsBlocked(blocked.includes(conversation.other_user_id))
    } catch {
      setIsBlocked(false)
    }
  }, [conversation?.other_user_id])

  const toggleBlock = () => {
    if (!conversation) return
    try {
      const blocked = JSON.parse(localStorage.getItem('chupa-blocked-users') || '[]')
      const targetId = conversation.other_user_id
      const next = blocked.includes(targetId)
        ? blocked.filter((id) => id !== targetId)
        : [...blocked, targetId]
      localStorage.setItem('chupa-blocked-users', JSON.stringify(next))
      setIsBlocked(!isBlocked)
    } catch { /* ignore */ }
    setShowOptions(false)
  }

  // Supabase Realtime Typing Broadcast Channel
  useEffect(() => {
    if (!conversation?.conversation_id || !user) return

    const typingChannel = supabase.channel(`typing-${conversation.conversation_id}`)
    channelRef.current = typingChannel

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setIsOtherTyping(true)
          clearTimeout(typingTimer.current)
          typingTimer.current = setTimeout(() => setIsOtherTyping(false), 2500)
        }
      })
      .subscribe()

    return () => {
      clearTimeout(typingTimer.current)
      supabase.removeChannel(typingChannel)
    }
  }, [conversation?.conversation_id, user])

  const handleSendTyping = useCallback(() => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id },
      })
    }
  }, [user])

  // Scroll to bottom
  useEffect(() => {
    if (!messagesEndRef.current) return
    messagesEndRef.current.scrollIntoView({ behavior: 'instant' })
  }, [conversation?.conversation_id])

  useEffect(() => {
    if (!messagesEndRef.current || !messages.length) return
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Desktop Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onBack) {
        onBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onBack])

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
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
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
        position: 'relative',
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

        <div style={{ position: 'relative' }}>
          <Avatar name={conversation.other_user_name} url={conversation.other_user_avatar} size={36} />
          {isOtherOnline && (
            <span style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 9, height: 9, borderRadius: '50%',
              background: 'var(--c-accent)',
              border: '1.5px solid var(--c-surface)',
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {conversation.other_user_name}
          </p>
          <p style={{
            fontSize: 11.5,
            color: isOtherTyping ? 'var(--c-accent)' : isOtherOnline ? 'var(--c-accent)' : 'var(--c-text-tertiary)',
            margin: 0, lineHeight: 1,
            fontWeight: isOtherTyping || isOtherOnline ? 600 : 400,
          }}>
            {isOtherTyping ? 'typing...' : isOtherOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        {/* Options trigger */}
        <button
          onClick={() => setShowOptions(!showOptions)}
          aria-label="Chat options"
          style={{
            width: 32, height: 32, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--c-text-secondary)',
            cursor: 'pointer',
          }}
        >
          ⋮
        </button>

        {/* Options dropdown */}
        {showOptions && (
          <div style={{
            position: 'absolute', top: '100%', right: 14, marginTop: 4,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-md)',
            zIndex: 100, overflow: 'hidden',
            minWidth: 160,
          }}>
            <button
              onClick={toggleBlock}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left',
                color: isBlocked ? 'var(--c-accent)' : 'var(--c-text)',
                background: 'none', cursor: 'pointer',
              }}
            >
              {isBlocked ? '🔓 Unblock user' : '🚫 Block user'}
            </button>
            <button
              onClick={() => {
                setShowOptions(false)
                if (window.confirm('Delete this conversation? This will clear all messages.')) {
                  onDeleteChat?.(conversation.conversation_id)
                }
              }}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left',
                color: 'var(--c-danger)', background: 'none', cursor: 'pointer',
                borderTop: '1px solid var(--c-border)',
              }}
            >
              🗑 Delete conversation
            </button>
          </div>
        )}
      </div>

      {/* Block banner */}
      {isBlocked && (
        <div style={{
          padding: '8px 14px',
          background: 'var(--c-danger-light)',
          color: 'var(--c-danger)',
          fontSize: 12,
          textAlign: 'center',
          borderBottom: '1px solid rgba(220,38,38,0.15)',
        }}>
          You have blocked this user. Unblock to send messages.
        </div>
      )}

      {/* ── Messages area ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '10px 14px 6px',
          overscrollBehavior: 'contain',
        }}
      >
        {loading ? (
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
          grouped.map(({ msg, showDate, dateLabel, isConsecutive }) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSender={msg.sender_id === user?.id}
              showDate={showDate}
              dateLabel={dateLabel}
              isConsecutive={isConsecutive}
              senderName={msg.sender_id === user?.id ? 'You' : conversation.other_user_name}
              isOtherOnline={isOtherOnline}
              onReply={(m) => setReplyingTo(m)}
              onDelete={deleteMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} style={{ height: 4 }} />
      </div>

      {/* ── Input ── */}
      <MessageInput
        onSend={sendMessage}
        disabled={isBlocked}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTyping={handleSendTyping}
      />
    </div>
  )
}
