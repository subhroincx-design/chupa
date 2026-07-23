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
  const { conversations, loading: convsLoading, error: convsError, deleteConversation } = useConversations()
  const { groups, createGroup, leaveGroup, joinGroup, addMembersToGroup } = useGroups()
  const { query, results, groupResults, searching, search, clearSearch } = useSearch()

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
        let convId = null

        // 1. Try RPC get_or_create_conversation (with p_user_a / p_user_b)
        const { data: rpcId, error: rpcErr } = await supabase.rpc('get_or_create_conversation', {
          p_user_a: user.id,
          p_user_b: selectedUser.id,
        })

        if (!rpcErr && rpcId) {
          convId = rpcId
        } else {
          // 2. Try RPC get_or_create_conversation (with p_user_1 / p_user_2)
          const { data: rpcId2, error: rpcErr2 } = await supabase.rpc('get_or_create_conversation', {
            p_user_1: user.id,
            p_user_2: selectedUser.id,
          })
          if (!rpcErr2 && rpcId2) {
            convId = rpcId2
          } else {
            // 3. Fallback to direct table queries
            const p1 = user.id < selectedUser.id ? user.id : selectedUser.id
            const p2 = user.id < selectedUser.id ? selectedUser.id : user.id

            // Check if existing conversation with participant_1 / participant_2
            const { data: ex1 } = await supabase
              .from('conversations')
              .select('id')
              .or(`and(participant_1.eq.${p1},participant_2.eq.${p2}),and(participant_1.eq.${p2},participant_2.eq.${p1})`)
              .maybeSingle()

            if (ex1?.id) {
              convId = ex1.id
            } else {
              // Check if existing conversation with user_a / user_b
              const { data: ex2 } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user_a.eq.${p1},user_b.eq.${p2}),and(user_a.eq.${p2},user_b.eq.${p1})`)
                .maybeSingle()

              if (ex2?.id) {
                convId = ex2.id
              } else {
                // Try inserting with participant_1 / participant_2
                const { data: ins1, error: insErr1 } = await supabase
                  .from('conversations')
                  .insert({ participant_1: p1, participant_2: p2 })
                  .select('id')
                  .single()

                if (!insErr1 && ins1?.id) {
                  convId = ins1.id
                } else {
                  // Try inserting with user_a / user_b
                  const { data: ins2 } = await supabase
                    .from('conversations')
                    .insert({ user_a: p1, user_b: p2 })
                    .select('id')
                    .single()

                  convId = ins2?.id || null
                }
              }
            }
          }
        }

        if (!convId) {
          console.error('Could not get or create conversation ID')
          return
        }

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

  const handleSelectGroupSearchResult = useCallback(
    async (group) => {
      try {
        await joinGroup(group.id)
        setActiveGroup(group)
        setActiveConversation(null)
        setMobileView('group')
        clearSearch()
        if (window.innerWidth < 768) {
          window.history.pushState({ chat: true }, '')
        }
      } catch (err) {
        console.error('Failed to join group:', err)
      }
    },
    [joinGroup, clearSearch]
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
    onSearch: (q) => search(q, activeTab),
    onClearSearch: clearSearch,
    searchResults: results,
    groupSearchResults: groupResults,
    searching,
    onSearchResultClick: handleSearchResultClick,
    onGroupSearchResultClick: handleSelectGroupSearchResult,
    loading: convsLoading,
    error: convsError,
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
          <GroupView group={activeGroup} onBack={handleBack} onLeaveGroup={handleLeaveGroup} onAddMembers={addMembersToGroup} />
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
        <GroupView group={activeGroup} onLeaveGroup={handleLeaveGroup} onAddMembers={addMembersToGroup} />
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
