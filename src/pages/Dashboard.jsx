import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useConversations } from '../hooks/useConversations'
import { useSearch } from '../hooks/useSearch'
import { supabase } from '../lib/supabase'
import ConversationList from '../components/ConversationList'
import ChatView from '../components/ChatView'

export default function Dashboard() {
  const { user } = useAuth()
  const { conversations, loading: convsLoading } = useConversations()
  const { query, results, searching, search, clearSearch } = useSearch()

  const [activeConversation, setActiveConversation] = useState(null)
  const [mobileView, setMobileView] = useState('list')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Smart Mobile Hardware Back Button Handling (popstate listener)
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
    searchQuery: query,
    onSearch: search,
    onClearSearch: clearSearch,
    searchResults: results,
    searching,
    onSearchResultClick: handleSearchResultClick,
    loading: convsLoading,
  }

  /* ── Mobile: zero-shake instant view swap ── */
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
          <ChatView conversation={activeConversation} onBack={handleBack} />
        )}
      </div>
    )
  }

  /* ── Desktop: floating card ── */
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--c-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflow: 'hidden',
    }}>
      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '10%',
        width: 700, height: 700,
        background: 'radial-gradient(circle, rgba(5,150,105,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '5%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* App frame */}
      <div
        style={{
          width: '100%',
          maxWidth: 1260,
          height: '100%',
          maxHeight: 880,
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <ConversationList {...sharedListProps} />
        <ChatView conversation={activeConversation} />
      </div>
    </div>
  )
}
