import { useState, useEffect, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchBar from './SearchBar'
import SearchResult from './SearchResult'
import ProfileMenu from './ProfileMenu'
import Logo from './Logo'
import Avatar from './Avatar'

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function ConversationItem({ conversation, isActive, isPinned, onPinToggle, onClick }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: isActive ? 'var(--c-accent-light)' : 'transparent',
        borderLeft: `3px solid ${isActive ? 'var(--c-accent)' : 'transparent'}`,
        transition: 'background 120ms',
      }}
    >
      <button
        id={`conversation-${conversation.conversation_id}`}
        onClick={() => onClick(conversation)}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 14px',
          textAlign: 'left',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          minHeight: 60,
          minWidth: 0,
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.parentElement.style.background = 'var(--c-surface-hover)' }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.parentElement.style.background = 'transparent' }}
      >
        <Avatar name={conversation.other_user_name} url={conversation.other_user_avatar} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              {isPinned && <span style={{ fontSize: 11 }}>📌</span>}
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, lineHeight: 1.3 }}>
                {conversation.other_user_name}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)', flexShrink: 0, fontWeight: 500, lineHeight: 1 }}>
              {formatRelativeTime(conversation.last_message_at || conversation.conversation_created_at)}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--c-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0' }}>
            {conversation.last_message
              ? conversation.last_message
              : <span style={{ color: 'var(--c-text-tertiary)', fontStyle: 'italic' }}>No messages yet</span>
            }
          </p>
        </div>
      </button>

      {/* Pin toggle button */}
      <button
        onClick={(e) => { e.stopPropagation(); onPinToggle(conversation.conversation_id) }}
        title={isPinned ? 'Unpin chat' : 'Pin chat'}
        style={{
          padding: '8px 10px',
          fontSize: 12,
          color: isPinned ? 'var(--c-accent)' : 'var(--c-text-tertiary)',
          cursor: 'pointer',
          opacity: isPinned ? 1 : 0.4,
          transition: 'opacity 120ms',
        }}
      >
        {isPinned ? '📌' : '📍'}
      </button>
    </div>
  )
}

function SkeletonConversation() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', minHeight: 60 }}>
      <div className="skeleton" style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="skeleton" style={{ height: 13, width: '52%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 11, width: '78%', borderRadius: 6 }} />
      </div>
    </div>
  )
}

export default function ConversationList({
  conversations, activeId, onSelect,
  searchQuery, onSearch, onClearSearch,
  searchResults, searching, onSearchResultClick, loading,
}) {
  const parentRef = useRef(null)

  // Pinned chats stored in localStorage
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('chupa-pinned-chats')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const togglePin = (convId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
      try {
        localStorage.setItem('chupa-pinned-chats', JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }

  // Sort pinned conversations to the top
  const sortedConversations = useMemo(() => {
    if (!pinnedIds.length) return conversations
    const pinned = conversations.filter((c) => pinnedIds.includes(c.conversation_id))
    const unpinned = conversations.filter((c) => !pinnedIds.includes(c.conversation_id))
    return [...pinned, ...unpinned]
  }, [conversations, pinnedIds])

  const shouldVirtualize = sortedConversations.length > 50
  const virtualizer = useVirtualizer({
    count: sortedConversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
    enabled: shouldVirtualize,
  })

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--c-border)',
      background: 'var(--c-surface)',
      paddingLeft: 'var(--safe-left)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 14px',
        paddingTop: 'calc(13px + var(--safe-top))',
        borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={28} />
          <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', margin: 0, letterSpacing: '-0.025em' }}>
            Chupa
          </h1>
        </div>
        <ProfileMenu />
      </div>

      {/* Search */}
      <div style={{ flexShrink: 0 }}>
        <SearchBar value={searchQuery} onChange={onSearch} onClear={onClearSearch} />
      </div>

      {/* Search results */}
      {searchQuery && (
        <div style={{ borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
          {searching ? (
            <div style={{ padding: '4px 0' }}>
              {[1, 2].map((i) => <SkeletonConversation key={i} />)}
            </div>
          ) : searchResults.length > 0 ? (
            <div style={{ maxHeight: 220, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {searchResults.map((u) => <SearchResult key={u.id} user={u} onClick={onSearchResultClick} />)}
            </div>
          ) : (
            <p style={{ padding: '14px 16px', fontSize: 13, color: 'var(--c-text-tertiary)' }}>
              No users found
            </p>
          )}
        </div>
      )}

      {/* Conversations list */}
      <div
        ref={parentRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => <SkeletonConversation key={i} />)}
          </div>
        ) : sortedConversations.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--c-accent-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 5px' }}>
              No conversations yet
            </p>
            <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', margin: 0, lineHeight: 1.55 }}>
              Search for someone above<br />to start chatting
            </p>
          </div>
        ) : shouldVirtualize ? (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vr) => {
              const conv = sortedConversations[vr.index]
              return (
                <div
                  key={conv.conversation_id}
                  data-index={vr.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vr.start}px)` }}
                >
                  <ConversationItem
                    conversation={conv}
                    isActive={activeId === conv.conversation_id}
                    isPinned={pinnedIds.includes(conv.conversation_id)}
                    onPinToggle={togglePin}
                    onClick={onSelect}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          sortedConversations.map((conv) => (
            <ConversationItem
              key={conv.conversation_id}
              conversation={conv}
              isActive={activeId === conv.conversation_id}
              isPinned={pinnedIds.includes(conv.conversation_id)}
              onPinToggle={togglePin}
              onClick={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
