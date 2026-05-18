import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { DEFAULT_PERMISSIONS } from '../config/navPages.js'

const NavPermissionsContext = createContext(null)

export const useNavPermissions = () => {
  const ctx = useContext(NavPermissionsContext)
  if (!ctx) throw new Error('useNavPermissions must be used inside NavPermissionsProvider')
  return ctx
}

export function NavPermissionsProvider({ children }) {
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'nav_permissions')
      .maybeSingle()
    if (data?.value) {
      // Mescla com defaults para garantir que novas páginas tenham valores
      setPermissions({ ...DEFAULT_PERMISSIONS, ...data.value, permissoes: ['admin'] })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (newPermissions, userId) => {
    // Garante que a página de permissões nunca fique acessível a não-admins
    const safe = { ...newPermissions, permissoes: ['admin'] }
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'nav_permissions', value: safe, updated_at: new Date().toISOString(), updated_by: userId },
        { onConflict: 'key' },
      )
    if (!error) setPermissions(safe)
    return !error
  }, [])

  return (
    <NavPermissionsContext.Provider value={{ permissions, loading, save }}>
      {children}
    </NavPermissionsContext.Provider>
  )
}
