import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useConversations } from '../hooks/useConversations'
import { useGroups } from '../hooks/useGroups'
import { useSearch } from '../hooks/useSearch'
import { supabase } from '../lib/supabase'
import { requestNotificationPermission } from '../utils/notifications'
import ConversationList from '../components/ConversationList'
import ChatView from '../components/ChatView'
import GroupView from '../components/GroupView'
import CreateGroupModal from '../components/CreateGroupModal'

export default function Dashboard() {
  const { user } = useAuth()
  const { conversations, loading: convsLoading, deleteConversation } = useConversations()
  const { groups, createGroup, leaveGroup } = useGroups()
  const { query, results, searching, search, clearSearch } = useSearch()

  const [activeTab, setActiveTab] = useState('chats') // 'chats' | 'groups'
  const [activeConversation, setActiveConversation] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)

  const [mobileView, setMobileView] = useState('list') // 'list' | 'chat' | 'group'
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    requestNotificationPermission().catch(() => {})
  }, [])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobile) return

    const handlePopState = (e) => {
      if (mobileView === 'chat' || mobileView === 'group') {
        e.preventDefault()
        setMobileView('list')
        setActiveConversation(null)
        setActiveGroup(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isMobile, mobileView])

  const handleSelectConversation = useCallback((conv) => {
    setActiveConversation(conv)
    setActiveGroup(null)
    setMobileView('chat')
    clearSearch()
    if (window.innerWidth < 768) {
      window.history.pushState({ chat: true }, '')
    }
  }, [clearSearch])

  const handleSelectGroup = useCallback((group) => {
    setActiveGroup(group)
    setActiveConversation(null)
    setMobileView('group')
    clearSearch()
    if (window.innerWidth < 768) {
      window.history.pushState({ chat: true }, '')
    }
  }, [clearSearch])

  const handleBack = useCallback(() => {
    if (window.history.state?.chat) {
      window.history.back()
    } else {
      setMobileView('list')
      setActiveConversation(null)
      setActiveGroup(null)
    }
  }, [])

  const handleDeleteChat = useCallback(
    async (convId) => {
      if (!convId) return
      const success = await deleteConversation(convId)
      if (success && activeConversation?.conversation_id === convId) {
        setActiveConversation(null)
        setMobileView('list')
      }
    },
    [deleteConversation, activeConversation]
  )

  const handleLeaveGroup = useCallback(
    async (groupId) => {
      if (!groupId) return
      await leaveGroup(groupId)
      if (activeGroup?.id === groupId) {
        setActiveGroup(null)
        setMobileView('list')
      }
    },
    [leaveGroup, activeGroup]
  )

  const handleSearchResultClick = useCallback(
    async (selectedUser) => {
      try {
        const { data: convId } = await supabase.rpc('get_or_create_conversation', {
          p_user_a: user.id,
          p_user_b: selectedUser.id,
        })
        const conv = {
          conversation_id: convId,
          other_user_id: selectedUser.id,
          other_user_name: selectedUser.name,
          other_user_username: selectedUser.username,
          other_user_avatar: selectedUser.avatar_url,
          last_message: null,
          last_message_at: null,
        }
        setActiveTab('chats')
        setActiveConversation(conv)
        setActiveGroup(null)
        setMobileView('chat')
        clearSearch()
        if (window.innerWidth < 768) {
          window.history.pushState({ chat: true }, '')
        }
      } catch (err) {
        console.error('Failed to create conversation:', err)
      }
    },
    [user, clearSearch]
  )

  const sharedListProps = {
    conversations,
    activeId: activeConversation?.conversation_id,
    onSelect: handleSelectConversation,
    groups,
    activeGroupId: activeGroup?.id,
    onSelectGroup: handleSelectGroup,
    onCreateGroupClick: () => setShowCreateGroup(true),
    activeTab,
    onTabChange: (t) => { setActiveTab(t); clearSearch() },
    onDeleteChat: handleDeleteChat,
    searchQuery: query,
    onSearch: search,
    onClearSearch: clearSearch,
    searchResults: results,
    searching,
    onSearchResultClick: handleSearchResultClick,
    loading: convsLoading,
  }

  /* ── Mobile View ── */
  if (isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--c-bg)', overflow: 'hidden' }}>
        {mobileView === 'list' && <ConversationList {...sharedListProps} />}
        {mobileView === 'chat' && (
          <ChatView conversation={activeConversation} onBack={handleBack} onDeleteChat={handleDeleteChat} />
        )}
        {mobileView === 'group' && (
          <GroupView group={activeGroup} onBack={handleBack} onLeaveGroup={handleLeaveGroup} />
        )}
        {showCreateGroup && (
          <CreateGroupModal
            conversations={conversations}
            onCreate={async (data) => {
              const newG = await createGroup(data)
              if (newG) {
                setActiveTab('groups')
                handleSelectGroup(newG)
              }
              return newG
            }}
            onClose={() => setShowCreateGroup(false)}
          />
        )}
      </div>
    )
  }

  /* ── Desktop View ── */
  return (
    <div style={{
      position: 'fixed', inset: 0, width: '100vw', height: '100vh',
      background: 'var(--c-bg)', display: 'grid',
      gridTemplateColumns: '320px 1fr', overflow: 'hidden',
    }}>
      <ConversationList {...sharedListProps} />

      {activeTab === 'groups' || activeGroup ? (
        <GroupView group={activeGroup} onLeaveGroup={handleLeaveGroup} />
      ) : (
        <ChatView conversation={activeConversation} onDeleteChat={handleDeleteChat} />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          conversations={conversations}
          onCreate={async (data) => {
            const newG = await createGroup(data)
            if (newG) {
              setActiveTab('groups')
              handleSelectGroup(newG)
            }
            return newG
          }}
          onClose={() => setShowCreateGroup(false)}
        />
      )}
    </div>
  )
}
