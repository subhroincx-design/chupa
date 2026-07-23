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

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (fetchError) setError(fetchError.message)
      else setMessages(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [conversationId])

  const sendMessage = useCallback(async (content, imageFile) => {
    if (!conversationId || !user) return false
    if (!content?.trim() && !imageFile) return false

    const sanitized = content?.trim() ? sanitizeMessage(content) : null

    // Rate limit: max 4 per 3s
    const now = Date.now()
    sendTimestamps.current = sendTimestamps.current.filter(t => now - t < 3000)
    if (sendTimestamps.current.length >= 4) {
      setError('Sending too fast. Please wait.')
      return false
    }
    sendTimestamps.current.push(now)

    let imageUrl = null
    if (imageFile) {
      if (imageFile.size > 5 * 1024 * 1024) {
        setError('Image must be under 5MB')
        return false
      }
      try {
        const ext = imageFile.name.split('.').pop().toLowerCase()
        const path = `chats/${conversationId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('chat-media')
          .upload(path, imageFile, { contentType: imageFile.type })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path)
          imageUrl = urlData?.publicUrl || null
        } else {
          console.error('Image upload error:', upErr)
          setError(`Image upload failed: ${upErr.message || 'Check storage bucket exists'}`)
          return false
        }
      } catch (upEx) {
        console.error('Image upload exception:', upEx)
        setError('Image upload failed. Please try again.')
        return false
      }
    }

    // content must not be null — if image-only, use empty string
    // (DB constraint will be relaxed via SQL patch; this is a safe fallback)
    const payload = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: sanitized,
    }
    if (imageUrl) {
      payload.image_url = imageUrl
    }

    const { data: insertedMsg, error: sendError } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single()

    if (sendError) {
      console.error('Message insert error:', sendError)
      setError(sendError.message)
      return false
    }

    // Optimistically add to local state so it shows instantly
    // (realtime will also fire and dedup via the id check)
    if (insertedMsg) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === insertedMsg.id)) return prev
        return [...prev, insertedMsg]
      })
    }

    setError(null)
    return true
  }, [conversationId, user])

  const deleteMessage = useCallback(async (messageId) => {
    if (!messageId || !user) return false
    setMessages(prev => prev.filter(m => m.id !== messageId))
    const { error: delError } = await supabase
      .from('messages').delete()
      .eq('id', messageId).eq('sender_id', user.id)
    if (delError) { fetchMessages(); return false }
    return true
  }, [user, fetchMessages])

  return { messages, loading, error, sendMessage, deleteMessage }
}
