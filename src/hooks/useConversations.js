import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sendLocalNotification } from '../utils/notifications'

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
      // Bypass the RPC because the user might have an outdated database function
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)

      if (convError) {
        console.error('Fetch conversations error:', convError)
        if (isMounted.current) setError(convError.message)
        return
      }

      if (!convs || convs.length === 0) {
        globalConversationsCache = []
        if (isMounted.current) {
          setConversations([])
          setError(null)
        }
        return
      }

      const otherIds = convs.map(c => c.participant_1 === user.id ? c.participant_2 : c.participant_1)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', otherIds)

      const enriched = await Promise.all(
        convs.map(async (c) => {
          const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1
          const profile = profiles?.find((p) => p.id === otherId)
          
          // Select * to safely avoid crashes if image_url column doesn't exist
          const { data: msg } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          return {
            conversation_id: c.id,
            other_user_id: otherId,
            other_user_name: profile?.name || 'Unknown',
            other_user_username: profile?.username || '',
            other_user_avatar: profile?.avatar_url || null,
            last_message: msg?.content || null,
            last_message_image: msg?.image_url || null,
            last_message_at: msg?.created_at || null,
            conversation_created_at: c.created_at,
          }
        })
      )

      // Sort by newest message first
      enriched.sort((a, b) => {
        const timeA = new Date(a.last_message_at || a.conversation_created_at).getTime()
        const timeB = new Date(b.last_message_at || b.conversation_created_at).getTime()
        return timeB - timeA
      })

      globalConversationsCache = enriched
      if (isMounted.current) {
        setConversations(enriched)
        setError(null)
      }
    } catch (err) {
      console.error('Unexpected error in fetchConversations:', err)
      if (isMounted.current) setError(err.message)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    isMounted.current = true
    if (!user) {
      globalConversationsCache = []
      setConversations([])
      setLoading(false)
      return
    }
    fetchConversations(globalConversationsCache.length === 0)
    return () => { isMounted.current = false }
  }, [user, fetchConversations])

  // Subscribe to realtime message insertions to update conversation list & trigger native notifications
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
              const matchedConv = prev[idx]

              // Trigger native Android & Web notification if message is from another user
              if (newMsg.sender_id !== user.id) {
                sendLocalNotification(matchedConv.other_user_name || 'Chupa', newMsg.content)
              }

              const updatedConv = {
                ...matchedConv,
                last_message: newMsg.content || null,
                last_message_image: newMsg.image_url || null,
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
