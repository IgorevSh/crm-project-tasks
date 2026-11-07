import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey =  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !anonKey) {
  throw new Error(
    'Задайте в .env: VITE_SUPABASE_URL и  VITE_SUPABASE_PUBLISHABLE_KEY',
  )
}

export const supabase = createClient(url, anonKey)
