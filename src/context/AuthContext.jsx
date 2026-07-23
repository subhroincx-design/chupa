import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { saveUserBio, fetchUserBio } from '../utils/bioManager'

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileFetched: false,
  authError: null,
  onlineUserIds: new Set(),
  isUserOnline: () => false,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())

  // Load profile instantly from localStorage cache
  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('chupa-profile-cache')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  // sessionChecked: true only after initial getSession() resolves — prevents flash-to-register
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profileFetched, setProfileFetched] = useState(() => {
    try {
      return !!localStorage.getItem('chupa-profile-cache')
    } catch {
      return false
    }
  })
  const [authError, setAuthError] = useState(null)
  const isInitialCheckDone = useRef(false)

  // Single Global Presence Channel
  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set())
      return
    }

    const presenceChannel = supabase.channel('online-presence-global', {
      config: { presence: { key: user.id } },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setOnlineUserIds(new Set(Object.keys(state)))
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUserIds((prev) => new Set([...prev, key]))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [user])

  const isUserOnline = useCallback(
    (userId) => {
      if (!userId) return false
      return onlineUserIds.has(userId)
    },
    [onlineUserIds]
  )

  const [isBanned, setIsBanned] = useState(false)

  const checkBanStatus = useCallback(async (userId, username) => {
    if (!userId) return
    try {
      const { data: bData } = await supabase
        .from('banned_users')
        .select('*')
        .or(`user_id.eq.${userId},username.ilike.${username || ''}`)
        .maybeSingle()

      if (bData) {
        setIsBanned(true)
        return
      }

      const bannedHandles = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
      if (username && bannedHandles.map(h => h.toLowerCase()).includes(username.toLowerCase())) {
        setIsBanned(true)
        return
      }

      setIsBanned(false)
    } catch {
      setIsBanned(false)
    }
  }, [])

  // Realtime Ban Enforcement: when subhro bans someone, instantly lock them out and revoke session
  useEffect(() => {
    if (!user) return

    const checkBan = () => {
      checkBanStatus(user.id, profile?.username || user?.user_metadata?.username)
    }

    const banChannel = supabase.channel('realtime-banned-users-check')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banned_users' }, checkBan)
      .subscribe()

    const timer = setInterval(checkBan, 4000)

    return () => {
      supabase.removeChannel(banChannel)
      clearInterval(timer)
    }
  }, [user, profile?.username, checkBanStatus])

  // Auto-sync logged in user's bio to public CDN bucket so others can view it instantly
  useEffect(() => {
    if (user?.id) {
      const existingBio = user.user_metadata?.bio || localStorage.getItem(`chupa-bio-${user.id}`)
      if (existingBio) {
        saveUserBio(user.id, existingBio)
      }
    }
  }, [user?.id, user?.user_metadata?.bio])

  const fetchProfile = async (userId, targetUser = null) => {
    setProfileFetched(false)
    const currentUser = targetUser || user
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      let finalProf = data

      if (!error && data) {
        setProfile(data)
        try {
          localStorage.setItem('chupa-profile-cache', JSON.stringify(data))
        } catch { /* ignore storage quota */ }
      } else {
        // Auto-create/guarantee profile for any authenticated user to eliminate first-load refresh loops
        const meta = currentUser?.user_metadata
        const fallbackName = meta?.name || currentUser?.email?.split('@')[0] || 'User'
        const fallbackUsername = meta?.username || `user_${userId.slice(0, 6)}`

        const newProf = {
          id: userId,
          email: currentUser?.email || '',
          name: fallbackName,
          username: fallbackUsername,
          name_changed_at: new Date().toISOString(),
          username_changed_at: new Date().toISOString(),
        }

        try {
          const { data: createdProf } = await supabase
            .from('profiles')
            .upsert(newProf)
            .select('*')
            .maybeSingle()
          finalProf = createdProf || newProf
        } catch {
          finalProf = newProf
        }

        setProfile(finalProf)
        try {
          localStorage.setItem('chupa-profile-cache', JSON.stringify(finalProf))
        } catch {}
      }

      await checkBanStatus(userId, finalProf?.username || currentUser?.user_metadata?.username)

    } catch (err) {
      console.error('Profile fetch exception:', err)
    } finally {
      setProfileFetched(true)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user)
    }
  }

  const isOwner = profile?.username?.toLowerCase() === 'subhro' || user?.user_metadata?.username?.toLowerCase() === 'subhro'

  const banUser = async (targetId, targetUsername) => {
    try {
      await supabase.from('banned_users').upsert({
        user_id: targetId,
        username: targetUsername,
        banned_at: new Date().toISOString(),
        banned_by: user.id
      })
    } catch (err) {
      console.warn('banned_users table error:', err)
    }

    const current = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
    if (!current.includes(targetUsername)) {
      current.push(targetUsername)
      localStorage.setItem('chupa-banned-handles', JSON.stringify(current))
    }
  }

  const unbanUser = async (targetId, targetUsername) => {
    try {
      await supabase.from('banned_users').delete().or(`user_id.eq.${targetId},username.ilike.${targetUsername}`)
    } catch (err) {
      console.warn('banned_users delete error:', err)
    }

    const current = JSON.parse(localStorage.getItem('chupa-banned-handles') || '[]')
    const updated = current.filter(h => h.toLowerCase() !== targetUsername.toLowerCase())
    localStorage.setItem('chupa-banned-handles', JSON.stringify(updated))
  }

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (!isInitialCheckDone.current) {
        isInitialCheckDone.current = true
        setLoading(false)
      }
    }, 3000)

    const hash = window.location.hash
    const search = window.location.search

    if (hash.includes('error_description=') || search.includes('error_description=')) {
      const params = new URLSearchParams(hash.replace('#', '?') || search)
      const errorMsg = params.get('error_description')?.replace(/\+/g, ' ') || 'Authentication link expired or invalid'
      setAuthError(errorMsg)
    }

    const cleanUrlHash = () => {
      if (window.location.pathname === '/reset-password') return
      if (window.location.hash || window.location.search.includes('code=')) {
        window.history.replaceState(null, document.title, window.location.pathname)
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        cleanUrlHash()
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setProfileFetched(true)
        localStorage.removeItem('chupa-profile-cache')
      }
      clearTimeout(safetyTimer)
      isInitialCheckDone.current = true
      setSessionChecked(true)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // During password reset flow — don't redirect, let ResetPassword page handle it
        if (event === 'PASSWORD_RECOVERY') {
          if (!isInitialCheckDone.current) {
            clearTimeout(safetyTimer)
            isInitialCheckDone.current = true
            setLoading(false)
          }
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          cleanUrlHash()
          setAuthError(null)
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setProfileFetched(true)
          localStorage.removeItem('chupa-profile-cache')
        }

        if (!isInitialCheckDone.current) {
          clearTimeout(safetyTimer)
          isInitialCheckDone.current = true
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    setIsBanned(false)
    setProfile(null)
    setUser(null)
    setSession(null)
    setAuthError(null)
    setProfileFetched(false)
    try { localStorage.removeItem('chupa-profile-cache') } catch {}
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        sessionChecked,
        profileFetched,
        authError,
        onlineUserIds,
        isUserOnline,
        isBanned,
        isOwner,
        banUser,
        unbanUser,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
