import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,
  authError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  // `loading` is ONLY true during initial cold startup. Once false, stays false.
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [authError, setAuthError] = useState(null)
  const isInitialCheckDone = useRef(false)

  const fetchProfile = async (userId) => {
    try {
      setProfileLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error)
      }
      setProfile(data || null)
    } catch (err) {
      console.error('Profile fetch exception:', err)
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    // Safety Fallback: Guarantee loading is NEVER stuck longer than 3 seconds under any network condition
    const safetyTimer = setTimeout(() => {
      if (!isInitialCheckDone.current) {
        isInitialCheckDone.current = true
        setLoading(false)
      }
    }, 3000)

    // Check for error in magic link callback URL
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

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        cleanUrlHash()
        await fetchProfile(session.user.id)
      }
      clearTimeout(safetyTimer)
      isInitialCheckDone.current = true
      setLoading(false)
    })

    // Realtime auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          cleanUrlHash()
          setAuthError(null)
          // Fetch profile in background without resetting global loading state
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
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
    await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
    setAuthError(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        authError,
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
