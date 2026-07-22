import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useSearch() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const timeoutRef = useRef(null)

  const search = useCallback(
    (searchQuery) => {
      setQuery(searchQuery)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      if (!searchQuery.trim()) {
        setResults([])
        setSearching(false)
        return
      }

      setSearching(true)

      timeoutRef.current = setTimeout(async () => {
        try {
          const { data, error: searchError } = await supabase.rpc(
            'search_users',
            {
              p_query: searchQuery.trim(),
              p_current_user_id: user.id,
            }
          )

          if (searchError) {
            setError(searchError.message)
            setResults([])
          } else {
            setResults(data || [])
            setError(null)
          }
        } catch (err) {
          setError(err.message)
          setResults([])
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    [user]
  )

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setSearching(false)
    setError(null)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return { query, results, searching, error, search, clearSearch }
}
