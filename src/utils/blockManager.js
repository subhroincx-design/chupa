import { supabase } from '../lib/supabase'

const BLOCK_CACHE_PREFIX = 'chupa-block-list-'

export async function getBlockedUsers(userId) {
  if (!userId) return []
  const cacheKey = `${BLOCK_CACHE_PREFIX}${userId}`
  const cached = localStorage.getItem(cacheKey)

  try {
    const { data } = await supabase.storage
      .from('avatars')
      .download(`${userId}/blocked.json`)

    if (data) {
      const text = await data.text()
      const list = JSON.parse(text)
      if (Array.isArray(list)) {
        localStorage.setItem(cacheKey, JSON.stringify(list))
        return list
      }
    }
  } catch (err) {
    // Fall back to local cache if network/bucket unavailable
  }

  return cached ? JSON.parse(cached) : []
}

export async function isBlockActive(userA, userB) {
  if (!userA || !userB) return false
  const [listA, listB] = await Promise.all([
    getBlockedUsers(userA),
    getBlockedUsers(userB)
  ])
  return listA.includes(userB) || listB.includes(userA)
}

export async function toggleBlockUser(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) return false
  const list = await getBlockedUsers(currentUserId)
  const isCurrentlyBlocked = list.includes(targetUserId)

  const newList = isCurrentlyBlocked
    ? list.filter(id => id !== targetUserId)
    : [...list, targetUserId]

  // Save to local cache
  const cacheKey = `${BLOCK_CACHE_PREFIX}${currentUserId}`
  localStorage.setItem(cacheKey, JSON.stringify(newList))

  // Also sync legacy local key for backward compatibility
  const legacyBlocked = JSON.parse(localStorage.getItem('chupa-blocked-users') || '[]')
  const newLegacy = isCurrentlyBlocked
    ? legacyBlocked.filter(id => id !== targetUserId)
    : [...legacyBlocked, targetUserId]
  localStorage.setItem('chupa-blocked-users', JSON.stringify(newLegacy))

  // Sync to Supabase Storage CDN bucket so recipient devices know they are blocked
  try {
    const blob = new Blob([JSON.stringify(newList)], { type: 'application/json' })
    await supabase.storage
      .from('avatars')
      .upload(`${currentUserId}/blocked.json`, blob, { upsert: true, contentType: 'application/json' })
  } catch (err) {
    console.warn('Block sync warning:', err)
  }

  return !isCurrentlyBlocked
}
