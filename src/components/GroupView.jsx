import { useState, useEffect, useRef } from 'react'
import { useGroupMessages } from '../hooks/useGroupMessages'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../hooks/useSearch'
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

function AddMembersModal({ group, currentMembers, onAdd, onClose, onMembersAdded }) {
  const { query, results, searching, search } = useSearch()
  const [addingId, setAddingId] = useState(null)
  const [addedIds, setAddedIds] = useState([])

  const currentMemberIds = new Set(currentMembers.map(m => m.id))

  const handleAddUser = async (userObj) => {
    setAddingId(userObj.id)
    const success = await onAdd?.(group.id, [userObj.id])
    setAddingId(null)
    if (success !== false) {
      setAddedIds(prev => [...prev, userObj.id])
      onMembersAdded?.()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, background: 'var(--c-surface)',
          border: '1px solid var(--c-border)', borderRadius: 20,
          padding: '20px', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>
            Add Members to {group?.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by name or @username..."
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14,
            background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
            borderRadius: 12, color: 'var(--c-text)', outline: 'none', marginBottom: 14,
          }}
        />

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 160 }}>
          {searching ? (
            <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 20, margin: 0 }}>
              Searching...
            </p>
          ) : !query.trim() ? (
            <p style={{ fontSize: 12.5, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 20, margin: 0 }}>
              Type a name or username above to find people to add.
            </p>
          ) : results.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 20, margin: 0 }}>
              No users found matching "{query}"
            </p>
          ) : (
            results.map((u) => {
              const isAlreadyMember = currentMemberIds.has(u.id) || addedIds.includes(u.id)
              const isAdding = addingId === u.id

              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--c-bg)' }}>
                  <Avatar name={u.name} url={u.avatar_url} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)' }}>@{u.username}</span>
                  </div>

                  {isAlreadyMember ? (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-text-tertiary)', padding: '4px 10px' }}>
                      ✓ Member
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddUser(u)}
                      disabled={isAdding}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 700,
                        background: 'var(--c-accent)', color: '#fff',
                        border: 'none', borderRadius: 99, cursor: isAdding ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isAdding ? 'Adding...' : '+ Add'}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function GroupView({ group, onBack, onLeaveGroup, onAddMembers, onRemoveMember, onDeleteGroup, onOpenProfile }) {
  const { user, profile, isOwner } = useAuth()
  const { messages, loading, members, sendMessage, deleteMessage, refetchMembers } = useGroupMessages(group?.id)
  const [replyingTo, setReplyingTo] = useState(null)
  const [showOptions, setShowOptions] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showAddMembersModal, setShowAddMembersModal] = useState(false)
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
              onClick={() => { setShowAddMembersModal(true); setShowOptions(false) }}
              style={{ width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left', color: 'var(--c-text)', background: 'none', cursor: 'pointer' }}
            >
              ➕ Add members
            </button>
            <button
              onClick={() => { setShowMembersModal(true); setShowOptions(false) }}
              style={{ width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left', color: 'var(--c-text)', background: 'none', cursor: 'pointer', borderTop: '1px solid var(--c-border)' }}
            >
              👥 Group members ({members.length})
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
            {(isOwner || group?.created_by === user?.id) && (
              <button
                onClick={async () => {
                  setShowOptions(false)
                  if (window.confirm(`Delete "${group.name}" completely?`)) {
                    await onDeleteGroup?.(group.id)
                  }
                }}
                style={{ width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left', color: 'var(--c-danger)', background: 'none', cursor: 'pointer', borderTop: '1px solid var(--c-border)', fontWeight: 700 }}
              >
                🗑️ Delete group
              </button>
            )}
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
          grouped.map(({ msg, showDate, dateLabel, isConsecutive }, idx) => {
            const isSender = msg.sender_id === user?.id
            const nextMsg = grouped[idx + 1]?.msg
            const isNextSameSender = nextMsg && nextMsg.sender_id === msg.sender_id && !grouped[idx + 1]?.showDate
            const showAvatar = !isSender && !isNextSameSender
            const showSenderHeader = !isSender && (!isConsecutive || showDate)
            const isSubhroOwner = msg.sender_name?.toLowerCase() === 'subhro' || msg.sender_name?.toLowerCase()?.includes('subhro')

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isSender={isSender}
                showDate={showDate}
                dateLabel={dateLabel}
                isConsecutive={isConsecutive}
                senderName={isSender ? 'You' : msg.sender_name || 'Member'}
                senderAvatar={msg.sender_avatar}
                showAvatar={showAvatar}
                showSenderHeader={showSenderHeader}
                isOwner={isSubhroOwner}
                onOpenProfile={onOpenProfile}
                isDelivered={true}
                onReply={(m) => setReplyingTo(m)}
                onDelete={deleteMessage}
              />
            )
          })
        )}
        <div ref={messagesEndRef} style={{ height: 4 }} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        disabled={loading}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        members={members}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => { setShowAddMembersModal(true); setShowMembersModal(false) }}
                  style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--c-accent)',
                    background: 'var(--c-accent-light)', border: 'none',
                    padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
                <button onClick={() => setShowMembersModal(false)} style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            {group.description && (
              <p style={{ fontSize: 12.5, color: 'var(--c-text-secondary)', marginBottom: 14, background: 'var(--c-bg)', padding: '8px 12px', borderRadius: 8 }}>
                {group.description}
              </p>
            )}
            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map((m) => (
                <div key={m.id || Math.random()} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    onClick={() => {
                      setShowMembersModal(false)
                      onOpenProfile?.(m)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <Avatar name={m.name} url={m.avatar_url} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text)', display: 'block' }}>{m.name}</span>
                        {(m.username?.toLowerCase() === 'subhro' || m.name?.toLowerCase() === 'subhro') && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--c-accent)', background: 'var(--c-accent-light)', padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>
                            👑 OWNER
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--c-text-tertiary)' }}>@{m.username}</span>
                    </div>
                  </div>
                  {m.role === 'admin' && (
                    <span style={{ fontSize: 10.5, color: 'var(--c-accent)', fontWeight: 700, background: 'var(--c-accent-light)', padding: '2px 6px', borderRadius: 99 }}>
                      Admin
                    </span>
                  )}
                  {(isOwner || group?.created_by === user?.id) && m.id !== user?.id && m.username?.toLowerCase() !== 'subhro' && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Remove ${m.name} from group?`)) {
                          await onRemoveMember?.(group.id, m.id)
                          refetchMembers()
                        }
                      }}
                      style={{ fontSize: 11, color: 'var(--c-danger)', background: 'rgba(239,68,68,0.1)', border: 'none', padding: '4px 8px', borderRadius: 99, cursor: 'pointer', fontWeight: 700 }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembersModal && (
        <AddMembersModal
          group={group}
          currentMembers={members}
          onAdd={onAddMembers}
          onMembersAdded={refetchMembers}
          onClose={() => setShowAddMembersModal(false)}
        />
      )}
    </div>
  )
}
