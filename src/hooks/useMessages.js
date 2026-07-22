import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sanitizeMessage } from '../utils/sanitize'

export function useMessages(conversationId) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const sendTimestamps = useRef([])

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return

    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setMessages(data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Realtime subscription (INSERT & DELETE)
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  // Send message with Anti-Spam Rate Limiter
  const sendMessage = useCallback(
    async (content) => {
      if (!conversationId || !user || !content.trim()) return

      const sanitized = sanitizeMessage(content)
      if (!sanitized) return

      // Anti-Spam Rate Limit: max 4 messages per 3 seconds window
      const now = Date.now()
      sendTimestamps.current = sendTimestamps.current.filter((t) => now - t < 3000)
      if (sendTimestamps.current.length >= 4) {
        setError('Sending too fast. Please wait a second.')
        return false
      }
      sendTimestamps.current.push(now)

      const { error: sendError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: sanitized,
      })

      if (sendError) {
        setError(sendError.message)
        return false
      }
      setError(null)
      return true
    },
    [conversationId, user]
  )

  // Delete message for everyone
  const deleteMessage = useCallback(
    async (messageId) => {
      if (!messageId || !user) return false

      // Optimistic delete in local state
      setMessages((prev) => prev.filter((m) => m.id !== messageId))

      const { error: delError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id)

      if (delError) {
        // Rollback on failure
        fetchMessages()
        setError(delError.message)
        return false
      }
      return true
    },
    [user, fetchMessages]
  )

  return { messages, loading, error, sendMessage, deleteMessage }
}
