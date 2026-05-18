import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ljbqumddeinvpoxulmrm.supabase.co'
const SUPABASE_KEY = 'sb_publishable_FULVqLs0S34LcLNLwqltmQ_2fqOoMLU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Client temporário para criar usuários sem afetar a sessão atual
export const createTempClient = () =>
  createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
