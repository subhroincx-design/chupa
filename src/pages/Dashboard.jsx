import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useConversations } from '../hooks/useConversations'
import { useSearch } from '../hooks/useSearch'
import { supabase } from '../lib/supabase'
import { requestNotificationPermission } from '../utils/notifications'
import ConversationList from '../components/ConversationList'
import ChatView from '../components/ChatView'

export default function Dashboard() {
  const { user } = useAuth()
  const { conversations, loading: convsLoading, deleteConversation } = useConversations()
  const { query, results, searching, search, clearSearch } = useSearch()

  const [activeConversation, setActiveConversation] = useState(null)
  const [mobileView, setMobileView] = useState('list')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  // Request Notification permission on Android & Desktop on dashboard mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {})
  }, [])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Smart Mobile Hardware Back Button Handling
  useEffect(() => {
    if (!isMobile) return

    const handlePopState = (e) => {
      if (mobileView === 'chat') {
        e.preventDefault()
        setMobileView('list')
        setActiveConversation(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isMobile, mobileView])

  const handleSelectConversation = useCallback((conv) => {
    setActiveConversation(conv)
    setMobileView('chat')
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
    }
  }, [])

  const handleDeleteChat = useCallback(
    async (convId) => {
      if (!convId) return
      const success = await deleteConversation(convId)
      if (success) {
        if (activeConversation?.conversation_id === convId) {
          setActiveConversation(null)
          setMobileView('list')
        }
      }
    },
    [deleteConversation, activeConversation]
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
        setActiveConversation(conv)
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
    onDeleteChat: handleDeleteChat,
    searchQuery: query,
    onSearch: search,
    onClearSearch: clearSearch,
    searchResults: results,
    searching,
    onSearchResultClick: handleSearchResultClick,
    loading: convsLoading,
  }

  /* ── Mobile View (single panel) ── */
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--c-bg)',
        overflow: 'hidden',
      }}>
        {mobileView === 'list' ? (
          <ConversationList {...sharedListProps} />
        ) : (
          <ChatView conversation={activeConversation} onBack={handleBack} onDeleteChat={handleDeleteChat} />
        )}
      </div>
    )
  }

  /* ── Desktop PC View (WhatsApp Web style full height dual-pane) ── */
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      background: 'var(--c-bg)',
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      overflow: 'hidden',
    }}>
      <ConversationList {...sharedListProps} />
      <ChatView conversation={activeConversation} onDeleteChat={handleDeleteChat} />
    </div>
  )
}
