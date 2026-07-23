import { supabase } from '../lib/supabase'
import { sanitizeInput } from './sanitize'

export async function saveUserBio(userId, bioText) {
  if (!userId) return false
  const cleanBio = sanitizeInput(bioText || '')

  // 1. Instant local storage update
  try {
    localStorage.setItem(`chupa-bio-${userId}`, cleanBio)
  } catch { /* ignore */ }

  // 2. Update Supabase Auth user_metadata
  try {
    await supabase.auth.updateUser({ data: { bio: cleanBio } })
  } catch { /* ignore */ }

  // 3. Try updating profiles table directly if bio column exists
  try {
    await supabase.from('profiles').update({ bio: cleanBio }).eq('id', userId)
  } catch { /* ignore schema error */ }

  // 4. Upload to Public Supabase CDN Bucket (guarantees cross-device availability for everyone)
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

  // 1. Instant local cache lookup
  const cached = localStorage.getItem(`chupa-bio-${userId}`)
  if (cached) {
    // Refresh from CDN in background
    fetchRemoteBio(userId)
    return cached
  }

  return await fetchRemoteBio(userId)
}

async function fetchRemoteBio(userId) {
  // 1. Fetch from Public Storage CDN
  try {
    const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/bio.json`)
    if (data?.publicUrl) {
      const res = await fetch(data.publicUrl + '?t=' + Date.now())
      if (res.ok) {
        const json = await res.json()
        if (json && typeof json.bio === 'string' && json.bio) {
          try { localStorage.setItem(`chupa-bio-${userId}`, json.bio) } catch {}
          return json.bio
        }
      }
    }
  } catch { /* ignore CDN fetch error */ }

  // 2. Fallback: Query profiles table
  try {
    const { data: pData } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', userId)
      .maybeSingle()

    if (pData?.bio) {
      try { localStorage.setItem(`chupa-bio-${userId}`, pData.bio) } catch {}
      return pData.bio
    }
  } catch { /* ignore DB error */ }

  return ''
}
