import { supabase } from '../lib/supabase'

const BLOCK_CACHE_PREFIX = 'chupa-block-list-'

export async function getBlockedUsers(userId) {
  if (!userId) return []
  const cacheKey = `${BLOCK_CACHE_PREFIX}${userId}`

  // 1. Try public URL fetch (bypasses RLS & cross-user auth limits)
  try {
    for (const ext of ['json', 'txt']) {
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${userId}/blocked.${ext}`)

      if (publicUrlData?.publicUrl) {
        const res = await fetch(`${publicUrlData.publicUrl}?t=${Date.now()}`)
        if (res.ok) {
          const list = await res.json()
          if (Array.isArray(list)) {
            localStorage.setItem(cacheKey, JSON.stringify(list))
            return list
          }
        } else if (res.status === 404 && ext === 'txt') {
          // If both .json and .txt return 404, there's no block file
          localStorage.setItem(cacheKey, JSON.stringify([]))
          return []
        }
      }
    }
  } catch (err) {
    // Network or CORS fallback
  }

  // 2. Storage download fallback
  try {
    for (const ext of ['json', 'txt']) {
      const { data } = await supabase.storage
        .from('avatars')
        .download(`${userId}/blocked.${ext}`)

      if (data) {
        const text = await data.text()
        const list = JSON.parse(text)
        if (Array.isArray(list)) {
          localStorage.setItem(cacheKey, JSON.stringify(list))
          return list
        }
      }
    }
  } catch (err) {
    // Cache fallback
  }

  const cached = localStorage.getItem(cacheKey)
  return cached ? JSON.parse(cached) : []
}

export async function checkBlockStatus(userA, userB) {
  if (!userA || !userB) return { isBlocked: false, blockedByMe: false, blockedByOther: false }
  try {
    const [listA, listB] = await Promise.all([
      getBlockedUsers(userA),
      getBlockedUsers(userB)
    ])
    const blockedByMe = Array.isArray(listA) && listA.includes(userB)
    const blockedByOther = Array.isArray(listB) && listB.includes(userA)
    return {
      isBlocked: blockedByMe || blockedByOther,
      blockedByMe,
      blockedByOther
    }
  } catch (err) {
    return { isBlocked: false, blockedByMe: false, blockedByOther: false }
  }
}

export async function isBlockActive(userA, userB) {
  const status = await checkBlockStatus(userA, userB)
  return status.isBlocked
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

  // Legacy fallback key
  const legacyBlocked = JSON.parse(localStorage.getItem('chupa-blocked-users') || '[]')
  const newLegacy = isCurrentlyBlocked
    ? legacyBlocked.filter(id => id !== targetUserId)
    : [...legacyBlocked, targetUserId]
  localStorage.setItem('chupa-blocked-users', JSON.stringify(newLegacy))

// Sync to public storage CDN bucket
  try {
    const jsonString = JSON.stringify(newList)
    
    // Attempt 1: blocked.json
    let { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(`${currentUserId}/blocked.json`, jsonString, {
        upsert: true,
        contentType: 'application/json',
        cacheControl: '0'
      })

    // Attempt 2: If RLS blocks .json, try .txt
    if (uploadErr) {
      await supabase.storage
        .from('avatars')
        .upload(`${currentUserId}/blocked.txt`, jsonString, {
          upsert: true,
          contentType: 'text/plain',
          cacheControl: '0'
        })
    }
  } catch (err) {
    console.warn('Block sync warning:', err)
  }

  // Also broadcast block change event so open chat windows update immediately
  try {
    const channel = supabase.channel('global-block-events')
    await channel.send({
      type: 'broadcast',
      event: 'block_toggled',
      payload: { blockerId: currentUserId, targetId: targetUserId, blocked: !isCurrentlyBlocked }
    })
  } catch (err) {
    // broadcast best-effort
  }

  return !isCurrentlyBlocked
}
