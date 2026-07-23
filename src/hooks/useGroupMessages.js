import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useGroupMessages(groupId) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState(() => {
    if (!groupId) return []
    try {
      const cached = localStorage.getItem(`chupa-group-msgs-${groupId}`)
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(() => {
    if (!groupId) return false
    try {
      const cached = localStorage.getItem(`chupa-group-msgs-${groupId}`)
      return !cached || JSON.parse(cached).length === 0
    } catch {
      return true
    }
  })
  const [members, setMembers] = useState([])
  const sendTs = useRef([])

  const updateMessagesCache = (msgList) => {
    setMessages(msgList)
    if (groupId) {
      try {
        localStorage.setItem(`chupa-group-msgs-${groupId}`, JSON.stringify(msgList))
      } catch { /* ignore storage quota */ }
    }
  }

  const fetchMessages = useCallback(async () => {
    if (!groupId) return
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
      if (!error && data) updateMessagesCache(data)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  const fetchMembers = useCallback(async () => {
    if (!groupId) return
    try {
      // 1. Try joined query first
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, role, profiles(id, name, username, avatar_url)')
        .eq('group_id', groupId)

      if (!error && data && data.length > 0 && data.some(m => m.profiles)) {
        setMembers(data.map(m => ({
          id: m.profiles?.id || m.user_id,
          name: m.profiles?.name || 'Member',
          username: m.profiles?.username || 'user',
          avatar_url: m.profiles?.avatar_url || null,
          role: m.role,
        })))
        return
      }

      // 2. Fallback: manual 2-step query if PostgREST embedding didn't populate
      const { data: memberRows, error: memErr } = await supabase
        .from('group_members')
        .select('user_id, role')
        .eq('group_id', groupId)

      if (!memErr && memberRows && memberRows.length > 0) {
        const uids = memberRows.map(m => m.user_id)
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', uids)

        const profMap = new Map((profs || []).map(p => [p.id, p]))
        const memberList = memberRows.map(m => {
          const p = profMap.get(m.user_id) || {}
          return {
            id: m.user_id,
            name: p.name || 'Member',
            username: p.username || 'user',
            avatar_url: p.avatar_url || null,
            role: m.role,
          }
        })
        setMembers(memberList)
      } else {
        setMembers([])
      }
    } catch (err) {
      console.error('Error in fetchMembers:', err)
    }
  }, [groupId])

  useEffect(() => {
    fetchMessages()
    fetchMembers()
  }, [fetchMessages, fetchMembers])

  // Realtime messages & members
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
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        fetchMembers()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [groupId, fetchMembers])

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
    const isOwner = profile?.username?.toLowerCase() === 'subhro' || user?.user_metadata?.username?.toLowerCase() === 'subhro'
    if (isOwner) {
      await supabase.from('group_messages').delete().eq('id', messageId)
    } else {
      await supabase.from('group_messages').delete().eq('id', messageId).eq('sender_id', user.id)
    }
  }, [user, profile])

  return { messages, loading, members, sendMessage, deleteMessage, refetch: fetchMessages, refetchMembers: fetchMembers }
}
