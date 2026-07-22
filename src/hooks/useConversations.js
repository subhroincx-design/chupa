import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchConversations = useCallback(async () => {
    if (!user) return

    try {
      const { data, error: fetchError } = await supabase.rpc(
        'get_conversations_for_user',
        { p_uid: user.id }
      )

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setConversations(data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Subscribe to new messages to update conversation list
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
        () => {
          // Refetch conversations when any new message arrives
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchConversations])

  return { conversations, loading, error, refetch: fetchConversations }
}
