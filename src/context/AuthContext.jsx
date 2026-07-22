import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setProfile(data)
        try {
          localStorage.setItem('chupa-profile-cache', JSON.stringify(data))
        } catch { /* ignore storage quota */ }
      } else {
        if (error && error.code === 'PGRST116') {
          setProfile(null)
          localStorage.removeItem('chupa-profile-cache')
        }
      }
    } catch (err) {
      console.error('Profile fetch exception:', err)
    } finally {
      setProfileFetched(true)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
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
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
    localStorage.removeItem('chupa-profile-cache')
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
    setAuthError(null)
    setProfileFetched(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileFetched,
        authError,
        onlineUserIds,
        isUserOnline,
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
