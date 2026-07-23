import { supabase } from '../lib/supabase'
import { sanitizeInput } from './sanitize'

export async function saveUserBio(userId, bioText) {
  if (!userId) return false
  const cleanBio = sanitizeInput(bioText || '')

  // 1. Local Cache
  try {
    localStorage.setItem(`chupa-bio-${userId}`, cleanBio)
  } catch { /* ignore */ }

  // 2. Auth user_metadata (for own profile)
  try {
    await supabase.auth.updateUser({ data: { bio: cleanBio } })
  } catch { /* ignore */ }

  // 3. Try updating profiles table directly
  try {
    const { error: pErr } = await supabase
      .from('profiles')
      .update({ bio: cleanBio })
      .eq('id', userId)

    if (!pErr) return true
  } catch { /* fallback to user_bios */ }

  // 4. Try upserting to user_bios fallback table
  try {
    await supabase
      .from('user_bios')
      .upsert({ user_id: userId, bio: cleanBio, updated_at: new Date().toISOString() })
  } catch (err) {
    console.warn('user_bios table upsert fallback error:', err)
  }

  return true
}

export async function fetchUserBio(userId) {
  if (!userId) return ''

  // 1. Check local cache first for instant render
  const cached = localStorage.getItem(`chupa-bio-${userId}`)

  // 2. Query profiles table
  try {
    const { data: pData } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', userId)
      .maybeSingle()

    if (pData && pData.bio !== undefined && pData.bio !== null) {
      try { localStorage.setItem(`chupa-bio-${userId}`, pData.bio) } catch {}
      return pData.bio
    }
  } catch { /* ignore */ }

  // 3. Query user_bios table fallback
  try {
    const { data: bData } = await supabase
      .from('user_bios')
      .select('bio')
      .eq('user_id', userId)
      .maybeSingle()

    if (bData && bData.bio) {
      try { localStorage.setItem(`chupa-bio-${userId}`, bData.bio) } catch {}
      return bData.bio
    }
  } catch { /* ignore */ }

  return cached || ''
}
