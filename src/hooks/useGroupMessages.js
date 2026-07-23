import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useGroupMessages(groupId) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const sendTs = useRef([])

  const fetchMessages = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
      if (!error) setMessages(data || [])
    } finally {
      setLoading(false)
    }
  }, [groupId])

  const fetchMembers = useCallback(async () => {
    if (!groupId) return
    const { data } = await supabase
      .from('group_members')
      .select('user_id, role, profiles(id, name, username, avatar_url)')
      .eq('group_id', groupId)
    if (data) setMembers(data.map(m => ({ ...m.profiles, role: m.role })))
  }, [groupId])

  useEffect(() => {
    setMessages([])
    setLoading(true)
    fetchMessages()
    fetchMembers()
  }, [fetchMessages, fetchMembers])

  // Realtime
  useEffect(() => {
    if (!groupId) return
    const ch = supabase.channel(`group-msgs-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [groupId])

  const sendMessage = useCallback(async (content, imageFile) => {
    if (!groupId || !user) return false
    if (!content?.trim() && !imageFile) return false

    // Rate limit
    const now = Date.now()
    sendTs.current = sendTs.current.filter(t => now - t < 3000)
    if (sendTs.current.length >= 5) return false
    sendTs.current.push(now)

    let imageUrl = null
    if (imageFile) {
      if (imageFile.size > 5 * 1024 * 1024) return false
      try {
        const ext = imageFile.name.split('.').pop().toLowerCase()
        const path = `groups/${groupId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('chat-media').upload(path, imageFile, { contentType: imageFile.type })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)
          imageUrl = publicUrl
        }
      } catch { /* ignore */ }
    }

    const { error } = await supabase.from('group_messages').insert({
      group_id: groupId,
      sender_id: user.id,
      sender_name: profile?.name || 'Unknown',
      sender_avatar: profile?.avatar_url || null,
      content: content?.trim() || null,
      image_url: imageUrl,
    })
    return !error
  }, [groupId, user, profile])

  const deleteMessage = useCallback(async (messageId) => {
    if (!messageId || !user) return
    setMessages(prev => prev.filter(m => m.id !== messageId))
    await supabase.from('group_messages').delete().eq('id', messageId).eq('sender_id', user.id)
  }, [user])

  return { messages, loading, members, sendMessage, deleteMessage, refetch: fetchMessages }
}
