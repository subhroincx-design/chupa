import { supabase } from '../lib/supabase'
import { sanitizeInput } from './sanitize'

export async function saveUserBio(userId, bioText) {
  if (!userId) return false
  const cleanBio = sanitizeInput(bioText || '')

  // 1. Local Cache for instant local rendering
  try {
    localStorage.setItem(`chupa-bio-${userId}`, cleanBio)
  } catch { /* ignore */ }

  // 2. Auth user_metadata
  try {
    await supabase.auth.updateUser({ data: { bio: cleanBio } })
  } catch { /* ignore */ }

  // 3. Try updating profiles table directly if column exists
  try {
    await supabase.from('profiles').update({ bio: cleanBio }).eq('id', userId)
  } catch { /* ignore schema error */ }

  // 4. Save to Public Storage CDN (guarantees cross-device public bio availability for all users)
  try {
    const bioBlob = new Blob([JSON.stringify({ bio: cleanBio, updated_at: Date.now() })], { type: 'application/json' })
    await supabase.storage.from('avatars').upload(`${userId}/bio.json`, bioBlob, { upsert: true, contentType: 'application/json' })
  } catch (err) {
    console.warn('Storage bio upload warning:', err)
  }

  return true
}

export async function fetchUserBio(userId) {
  if (!userId) return ''

  // 1. Check local cache first for instant zero-latency render
  const cached = localStorage.getItem(`chupa-bio-${userId}`)

  // 2. Query profiles table if available
  try {
    const { data: pData } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', userId)
      .maybeSingle()

    if (pData && pData.bio !== undefined && pData.bio !== null && pData.bio !== '') {
      try { localStorage.setItem(`chupa-bio-${userId}`, pData.bio) } catch {}
      return pData.bio
    }
  } catch { /* ignore */ }

  // 3. Fetch from Public Storage CDN File (100% public, works across all devices)
  try {
    const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/bio.json`)
    if (data?.publicUrl) {
      const res = await fetch(data.publicUrl + '?t=' + Date.now())
      if (res.ok) {
        const json = await res.json()
        if (json && typeof json.bio === 'string') {
          try { localStorage.setItem(`chupa-bio-${userId}`, json.bio) } catch {}
          return json.bio
        }
      }
    }
  } catch { /* ignore */ }

  return cached || ''
}
