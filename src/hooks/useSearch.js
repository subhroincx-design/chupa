import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useSearch() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [groupResults, setGroupResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const timeoutRef = useRef(null)

  const search = useCallback(
    (searchQuery, searchType = 'chats') => {
      setQuery(searchQuery)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      if (!searchQuery.trim()) {
        setResults([])
        setGroupResults([])
        setSearching(false)
        return
      }

      setSearching(true)

      timeoutRef.current = setTimeout(async () => {
        try {
          if (searchType === 'groups') {
            const { data, error: groupErr } = await supabase
              .from('groups')
              .select('*')
              .ilike('name', `%${searchQuery.trim()}%`)
              .limit(20)

            if (groupErr) {
              setError(groupErr.message)
              setGroupResults([])
            } else {
              setGroupResults(data || [])
              setError(null)
            }
          } else {
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
          }
        } catch (err) {
          setError(err.message)
          setResults([])
          setGroupResults([])
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
    setGroupResults([])
    setSearching(false)
    setError(null)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return { query, results, groupResults, searching, error, search, clearSearch }
}
