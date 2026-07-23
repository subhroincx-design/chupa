import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useGroups() {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGroups = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, role, groups(id, name, description, avatar_url, created_by, created_at)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })

      if (!error && data) {
        setGroups(data.map(row => ({ ...row.groups, myRole: row.role })))
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  // Realtime: refresh when group_members changes
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('group-list-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` }, () => fetchGroups())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups' }, () => fetchGroups())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user, fetchGroups])

  const createGroup = useCallback(async ({ name, description, memberIds, avatarFile }) => {
    if (!user || !name.trim()) return null
    try {
      // 1. Create group
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .insert({ name: name.trim(), description: description?.trim() || null, created_by: user.id })
        .select().single()
      if (gErr || !group) return null

      // 2. Add creator as admin
      await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'admin' })

      // 3. Add other members
      if (memberIds && memberIds.length > 0) {
        await supabase.from('group_members').insert(
          memberIds.map(uid => ({ group_id: group.id, user_id: uid, role: 'member' }))
        )
      }

      // 4. Upload avatar if provided
      if (avatarFile) {
        try {
          const ext = avatarFile.name.split('.').pop().toLowerCase()
          const path = `groups/${group.id}/avatar.${ext}`
          await supabase.storage.from('chat-media').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
          const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)
          await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', group.id)
          group.avatar_url = publicUrl
        } catch { /* ignore avatar errors */ }
      }

      await fetchGroups()
      return group
    } catch {
      return null
    }
  }, [user, fetchGroups])

  const leaveGroup = useCallback(async (groupId) => {
    if (!user) return
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id)
    setGroups(prev => prev.filter(g => g.id !== groupId))
  }, [user])

  return { groups, loading, fetchGroups, createGroup, leaveGroup }
}
