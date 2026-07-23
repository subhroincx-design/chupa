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
      // 1. Try joined PostgREST query first
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, role, groups(id, name, description, avatar_url, created_by, created_at)')
        .eq('user_id', user.id)

      if (!error && data && data.length > 0 && data.some(row => row.groups)) {
        const groupList = data
          .filter(row => row.groups)
          .map(row => ({ ...row.groups, myRole: row.role }))
        setGroups(groupList)
        return
      }

      // 2. Fallback: manual 2-step query if join embedding didn't return groups object
      const { data: memberRows, error: memErr } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', user.id)

      if (!memErr && memberRows && memberRows.length > 0) {
        const groupIds = memberRows.map(m => m.group_id)
        const { data: groupDetails } = await supabase
          .from('groups')
          .select('id, name, description, avatar_url, created_by, created_at')
          .in('id', groupIds)

        const roleMap = new Map(memberRows.map(m => [m.group_id, m.role]))
        const groupList = (groupDetails || []).map(g => ({
          ...g,
          myRole: roleMap.get(g.id) || 'member',
        }))
        setGroups(groupList)
      } else {
        setGroups([])
      }
    } catch (err) {
      console.error('fetchGroups exception:', err)
      setGroups([])
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

      if (gErr) {
        console.error('Group creation error:', gErr)
        throw new Error(gErr.message || 'Failed to create group table record')
      }
      if (!group) return null

      // 2. Add creator as admin
      const { error: memErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'admin' })
      if (memErr) console.error('Add admin member error:', memErr)

      // 3. Add other members
      if (memberIds && memberIds.length > 0) {
        const { error: othersErr } = await supabase.from('group_members').insert(
          memberIds.map(uid => ({ group_id: group.id, user_id: uid, role: 'member' }))
        )
        if (othersErr) console.error('Add members error:', othersErr)
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
        } catch { /* ignore avatar upload errors */ }
      }

      await fetchGroups()
      return group
    } catch (err) {
      console.error('createGroup exception:', err)
      throw err
    }
  }, [user, fetchGroups])

  const leaveGroup = useCallback(async (groupId) => {
    if (!user) return
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id)
    setGroups(prev => prev.filter(g => g.id !== groupId))
  }, [user])

  const joinGroup = useCallback(async (groupId) => {
    if (!user || !groupId) return null
    try {
      // Check if already a member first to preserve existing role (e.g., admin)
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existingMember) {
        const { error } = await supabase
          .from('group_members')
          .insert({ group_id: groupId, user_id: user.id, role: 'member' })
        if (error) console.error('Error joining group:', error)
      }

      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle()

      await fetchGroups()
      return groupData || null
    } catch (err) {
      console.error('joinGroup exception:', err)
      return null
    }
  }, [user, fetchGroups])

  const addMembersToGroup = useCallback(async (groupId, userIds) => {
    if (!user || !groupId || !userIds?.length) return false
    try {
      const rows = userIds.map(uid => ({
        group_id: groupId,
        user_id: uid,
        role: 'member'
      }))
      const { error } = await supabase
        .from('group_members')
        .upsert(rows, { onConflict: 'group_id,user_id' })

      if (error) {
        console.error('Error adding members to group:', error)
        return false
      }
      await fetchGroups()
      return true
    } catch (err) {
      console.error('addMembersToGroup exception:', err)
      return false
    }
  }, [user, fetchGroups])

  const removeMemberFromGroup = useCallback(async (groupId, userId) => {
    if (!user || !groupId || !userId) return false
    try {
      await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
      await fetchGroups()
      return true
    } catch (err) {
      console.error('removeMemberFromGroup exception:', err)
      return false
    }
  }, [user, fetchGroups])

  const deleteGroup = useCallback(async (groupId) => {
    if (!user || !groupId) return false
    try {
      await supabase.from('group_messages').delete().eq('group_id', groupId)
      await supabase.from('group_members').delete().eq('group_id', groupId)
      await supabase.from('groups').delete().eq('id', groupId)
      setGroups(prev => prev.filter(g => g.id !== groupId))
      return true
    } catch (err) {
      console.error('deleteGroup exception:', err)
      return false
    }
  }, [user])

  const searchAllGroups = useCallback(async (searchQuery) => {
    if (!searchQuery?.trim()) return []
    const { data } = await supabase
      .from('groups')
      .select('*')
      .ilike('name', `%${searchQuery.trim()}%`)
      .limit(20)
    return data || []
  }, [])

  return { groups, loading, fetchGroups, createGroup, leaveGroup, joinGroup, addMembersToGroup, removeMemberFromGroup, deleteGroup, searchAllGroups }
}
