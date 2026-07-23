import { useState, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '../context/AuthContext'
import SearchBar from './SearchBar'
import SearchResult from './SearchResult'
import ProfileMenu from './ProfileMenu'
import InstallGuideModal from './InstallGuideModal'
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

function ConversationItem({ conversation, isActive, isPinned, isOnline, onPinToggle, onClick }) {
  return (
    <div
      style={{
        position: 'relative', display: 'flex', alignItems: 'center',
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
          padding: '11px 14px', textAlign: 'left', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', minHeight: 60, minWidth: 0,
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.parentElement.style.background = 'var(--c-surface-hover)' }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.parentElement.style.background = 'transparent' }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar name={conversation.other_user_name} url={conversation.other_user_avatar} size={42} />
          {isOnline && (
            <span style={{
              position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%',
              background: 'var(--c-accent)', border: '2px solid var(--c-surface)',
            }} />
          )}
        </div>
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

      <button
        onClick={(e) => { e.stopPropagation(); onPinToggle(conversation.conversation_id) }}
        title={isPinned ? 'Unpin chat' : 'Pin chat'}
        style={{
          padding: '8px 10px', fontSize: 12,
          color: isPinned ? 'var(--c-accent)' : 'var(--c-text-tertiary)',
          cursor: 'pointer', opacity: isPinned ? 1 : 0.4, transition: 'opacity 120ms',
        }}
      >
        {isPinned ? '📌' : '📍'}
      </button>
    </div>
  )
}

function GroupItem({ group, isActive, onClick }) {
  return (
    <button
      onClick={() => onClick(group)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', textAlign: 'left', cursor: 'pointer',
        background: isActive ? 'var(--c-accent-light)' : 'transparent',
        borderLeft: `3px solid ${isActive ? 'var(--c-accent)' : 'transparent'}`,
        transition: 'background 120ms', minHeight: 60,
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--c-surface-hover)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <Avatar name={group.name} url={group.avatar_url} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.name}
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--c-text-tertiary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.description || 'Tap to chat'}
        </p>
      </div>
    </button>
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
  groups = [], activeGroupId, onSelectGroup, onCreateGroupClick,
  activeTab = 'chats', onTabChange,
  searchQuery, onSearch, onClearSearch,
  searchResults, searching, onSearchResultClick, loading,
}) {
  const { isUserOnline } = useAuth()
  const parentRef = useRef(null)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [hideBanner, setHideBanner] = useState(false)

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

  const sortedConversations = useMemo(() => {
    if (!pinnedIds.length) return conversations
    const pinned = conversations.filter((c) => pinnedIds.includes(c.conversation_id))
    const unpinned = conversations.filter((c) => !pinnedIds.includes(c.conversation_id))
    return [...pinned, ...unpinned]
  }, [conversations, pinnedIds])

  const shouldVirtualize = activeTab === 'chats' && sortedConversations.length > 50
  const virtualizer = useVirtualizer({
    count: sortedConversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
    enabled: shouldVirtualize,
  })

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--c-border)', background: 'var(--c-surface)',
      paddingLeft: 'var(--safe-left)', position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 14px', paddingTop: 'calc(13px + var(--safe-top))',
        borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)',
        flexShrink: 0, position: 'relative', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={28} />
          <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', margin: 0, letterSpacing: '-0.025em' }}>
            Chupa
          </h1>
        </div>
        <ProfileMenu />
      </div>

      {/* Prominent Install App Banner Card */}
      {!hideBanner && (
        <div style={{
          margin: '8px 12px 2px',
          padding: '10px 12px',
          background: 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(16,185,129,0.12))',
          border: '1px solid rgba(5,150,105,0.25)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--c-accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>📲</div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', display: 'block', lineHeight: 1.2 }}>Install Chupa App</span>
              <span style={{ fontSize: 11, color: 'var(--c-text-secondary)' }}>Add to mobile home screen</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setShowInstallModal(true)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 700,
                background: 'var(--c-accent)', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                flexShrink: 0,
              }}
            >
              Install →
            </button>
            <button
              onClick={() => setHideBanner(true)}
              style={{
                background: 'none', border: 'none', color: 'var(--c-text-tertiary)',
                fontSize: 12, cursor: 'pointer', padding: '2px 4px',
              }}
            >✕</button>
          </div>
        </div>
      )}

      {/* Tabs: Chats / Groups */}
      <div style={{
        display: 'flex', padding: '6px 12px', gap: 6,
        borderBottom: '1px solid var(--c-border)', flexShrink: 0,
        background: 'var(--c-bg)', marginTop: 4,
      }}>
        <button
          onClick={() => onTabChange?.('chats')}
          style={{
            flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 600,
            borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'chats' ? 'var(--c-surface)' : 'transparent',
            color: activeTab === 'chats' ? 'var(--c-text)' : 'var(--c-text-secondary)',
            boxShadow: activeTab === 'chats' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 120ms',
          }}
        >
          💬 Direct Messages
        </button>
        <button
          onClick={() => onTabChange?.('groups')}
          style={{
            flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 600,
            borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'groups' ? 'var(--c-surface)' : 'transparent',
            color: activeTab === 'groups' ? 'var(--c-text)' : 'var(--c-text-secondary)',
            boxShadow: activeTab === 'groups' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 120ms',
          }}
        >
          👥 Groups
        </button>
      </div>

      {/* Search Bar */}
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

      {/* Content list */}
      <div
        ref={parentRef}
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch', paddingBottom: 'var(--safe-bottom)',
        }}
      >
        {activeTab === 'chats' ? (
          loading ? (
            <div>{[1, 2, 3, 4].map((i) => <SkeletonConversation key={i} />)}</div>
          ) : sortedConversations.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 5px' }}>No conversations yet</p>
              <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', margin: 0 }}>Search for someone above to start chatting</p>
            </div>
          ) : shouldVirtualize ? (
            <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vr) => {
                const conv = sortedConversations[vr.index]
                return (
                  <div key={conv.conversation_id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vr.start}px)` }}>
                    <ConversationItem
                      conversation={conv}
                      isActive={activeId === conv.conversation_id}
                      isPinned={pinnedIds.includes(conv.conversation_id)}
                      isOnline={isUserOnline(conv.other_user_id)}
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
                isOnline={isUserOnline(conv.other_user_id)}
                onPinToggle={togglePin}
                onClick={onSelect}
              />
            ))
          )
        ) : (
          /* Groups tab */
          <div>
            <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Groups ({groups.length})
              </span>
              <button
                onClick={onCreateGroupClick}
                style={{
                  fontSize: 12.5, fontWeight: 600, color: 'var(--c-accent)',
                  background: 'var(--c-accent-light)', border: 'none',
                  padding: '5px 10px', borderRadius: 99, cursor: 'pointer',
                }}
              >
                + New Group
              </button>
            </div>

            {groups.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 5px' }}>No groups yet</p>
                <p style={{ fontSize: 12.5, color: 'var(--c-text-tertiary)', margin: '0 0 14px' }}>Create a group to chat with multiple people</p>
                <button
                  onClick={onCreateGroupClick}
                  style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 600,
                    background: 'var(--c-accent)', color: '#fff', borderRadius: 10, cursor: 'pointer',
                  }}
                >
                  + Create Group
                </button>
              </div>
            ) : (
              groups.map((g) => (
                <GroupItem
                  key={g.id}
                  group={g}
                  isActive={activeGroupId === g.id}
                  onClick={onSelectGroup}
                />
              ))
            )}
          </div>
        )}
      </div>

      {showInstallModal && <InstallGuideModal onClose={() => setShowInstallModal(false)} />}
    </div>
  )
}
