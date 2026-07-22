import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

let globalConversationsCache = []

export function useConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState(globalConversationsCache)
  const [loading, setLoading] = useState(globalConversationsCache.length === 0)
  const [error, setError] = useState(null)
  const isMounted = useRef(true)

  const fetchConversations = useCallback(async (showSkeleton = false) => {
    if (!user) return

    if (showSkeleton && globalConversationsCache.length === 0) {
      setLoading(true)
    }

    try {
      const { data, error: fetchError } = await supabase.rpc(
        'get_conversations_for_user',
        { p_uid: user.id }
      )

      if (fetchError) {
        if (isMounted.current) setError(fetchError.message)
      } else {
        const result = data || []
        globalConversationsCache = result
        if (isMounted.current) {
          setConversations(result)
          setError(null)
        }
      }
    } catch (err) {
      if (isMounted.current) setError(err.message)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    isMounted.current = true
    fetchConversations(globalConversationsCache.length === 0)
    return () => { isMounted.current = false }
  }, [fetchConversations])

  // Subscribe to realtime message insertions to update conversation list instantly
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('conversation-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.conversation_id === newMsg.conversation_id)
            if (idx !== -1) {
              const updatedConv = {
                ...prev[idx],
                last_message: newMsg.content,
                last_message_at: newMsg.created_at,
              }
              const rest = prev.filter((_, i) => i !== idx)
              const updatedList = [updatedConv, ...rest]
              globalConversationsCache = updatedList
              return updatedList
            }
            fetchConversations(false)
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchConversations])

  // Delete conversation
  const deleteConversation = useCallback(
    async (convId) => {
      if (!convId || !user) return false

      // Optimistic remove
      setConversations((prev) => {
        const next = prev.filter((c) => c.conversation_id !== convId)
        globalConversationsCache = next
        return next
      })

      const { error: delErr } = await supabase
        .from('conversations')
        .delete()
        .eq('id', convId)

      if (delErr) {
        console.error('Delete conversation error:', delErr)
        fetchConversations(false)
        return false
      }
      return true
    },
    [user, fetchConversations]
  )

  return {
    conversations,
    loading,
    error,
    refetch: () => fetchConversations(false),
    deleteConversation,
  }
}
