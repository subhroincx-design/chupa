import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: true,
  authError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const fetchProfile = async (userId) => {
    try {
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
      setProfileLoading(true)
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    // Check for error in magic link callback URL
    const hash = window.location.hash
    const search = window.location.search

    if (hash.includes('error_description=') || search.includes('error_description=')) {
      const params = new URLSearchParams(hash.replace('#', '?') || search)
      const errorMsg = params.get('error_description')?.replace(/\+/g, ' ') || 'Authentication error'
      setAuthError(errorMsg)
    }

    // Clean up hash/code parameters from URL after processing so URL is pristine
    const cleanUrlHash = () => {
      if (window.location.hash || window.location.search.includes('code=')) {
        window.history.replaceState(null, document.title, window.location.pathname)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        cleanUrlHash()
        fetchProfile(session.user.id)
      } else {
        setProfileLoading(false)
      }
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
          setProfileLoading(false)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
