import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tqhfnruxhsmmeckakpue.supabase.co'
const supabaseKey = 'sb_publishable_cyfcu_VTAw-_vpTJdEW9Dg_3P-FRvFC'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})
