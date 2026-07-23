import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sendLocalNotification } from '../utils/notifications'

let globalConversationsCache = (() => {
  try {
    const saved = localStorage.getItem('chupa-convs-cache')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
})()

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
      let rawConvs = []
      let convError = null

      // Attempt 1: Query conversations table with participant_1 / participant_2
      const res1 = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)

      if (!res1.error && res1.data && res1.data.length > 0) {
        rawConvs = res1.data.map((c) => ({
          id: c.id,
          other_user_id: c.participant_1 === user.id ? c.participant_2 : c.participant_1,
          created_at: c.created_at,
        }))
      } else {
        // Attempt 2: Query conversations table with user_a / user_b
        const res2 = await supabase
          .from('conversations')
          .select('*')
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

        if (!res2.error && res2.data && res2.data.length > 0) {
          rawConvs = res2.data.map((c) => ({
            id: c.id,
            other_user_id: c.user_a === user.id ? c.user_b : c.user_a,
            created_at: c.created_at,
          }))
        } else {
          // Attempt 3: Try RPC get_conversations_for_user
          const res3 = await supabase.rpc('get_conversations_for_user', { p_uid: user.id })
          if (!res3.error && res3.data && res3.data.length > 0) {
            const formatted = res3.data.map((c) => ({
              conversation_id: c.conversation_id || c.id,
              other_user_id: c.other_user_id,
              other_user_name: c.other_user_name || 'User',
              other_user_username: c.other_user_username || '',
              other_user_avatar: c.other_user_avatar || null,
              last_message: c.last_message || null,
              last_message_image: c.last_message_image || null,
              last_message_at: c.last_message_at || c.created_at,
              conversation_created_at: c.conversation_created_at || c.created_at,
            }))
            globalConversationsCache = formatted
            if (isMounted.current) {
              setConversations(formatted)
              setError(null)
            }
            return
          }
          convError = res1.error || res2.error || res3.error
        }
      }

      if (rawConvs.length === 0) {
        if (convError && res1.error?.code !== 'PGRST116') {
          console.error('Fetch conversations error:', convError)
          if (isMounted.current) setError(convError.message || 'Failed to fetch conversations')
        } else {
          globalConversationsCache = []
          if (isMounted.current) {
            setConversations([])
            setError(null)
          }
        }
        return
      }

      // Fetch profiles for all other users
      const otherIds = Array.from(new Set(rawConvs.map((c) => c.other_user_id).filter(Boolean)))
      const profilesMap = {}
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', otherIds)

        if (profiles) {
          profiles.forEach((p) => {
            profilesMap[p.id] = p
          })
        }
      }

      // Fetch last message for each conversation safely using select('*')
      const enriched = await Promise.all(
        rawConvs.map(async (c) => {
          const profile = profilesMap[c.other_user_id]
          const { data: msg } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          return {
            conversation_id: c.id,
            other_user_id: c.other_user_id,
            other_user_name: profile?.name || 'User',
            other_user_username: profile?.username || '',
            other_user_avatar: profile?.avatar_url || null,
            last_message: msg?.content || null,
            last_message_image: msg?.image_url || null,
            last_message_at: msg?.created_at || null,
            conversation_created_at: c.created_at,
          }
        })
      )

      // Sort by newest message or creation date
      enriched.sort((a, b) => {
        const timeA = new Date(a.last_message_at || a.conversation_created_at).getTime()
        const timeB = new Date(b.last_message_at || b.conversation_created_at).getTime()
        return timeB - timeA
      })

      globalConversationsCache = enriched
      try {
        localStorage.setItem('chupa-convs-cache', JSON.stringify(enriched))
      } catch { /* ignore storage quota */ }

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

  // Subscribe to realtime events to update conversation list & trigger notifications
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('conversation-updates')
      // Listen for new messages → update last_message preview
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new
          
          // DO NOT process messages from users we have blocked
          const blockedUsers = JSON.parse(localStorage.getItem(`chupa-block-list-${user.id}`) || '[]')
          if (newMsg.sender_id !== user.id && blockedUsers.includes(newMsg.sender_id)) {
            return
          }

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.conversation_id === newMsg.conversation_id)
            if (idx !== -1) {
              // Existing conversation — update last message preview
              const matchedConv = prev[idx]
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
            // Conversation not in list yet — do a full refresh to get it
            fetchConversations(false)
            return prev
          })
        }
      )
      // Listen for new conversations (when this user starts one, ensure it appears)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const c = payload.new
          const isParticipant =
            c.participant_1 === user.id || c.participant_2 === user.id ||
            c.user_a === user.id || c.user_b === user.id
          if (isParticipant) {
            // Small delay to let the DB settle before refetching
            setTimeout(() => fetchConversations(false), 300)
          }
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
