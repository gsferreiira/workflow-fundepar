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
      if (data.value._legacy_migrated) {
        // DB foi salvo após a migração — confiar inteiramente nos dados salvos
        const { _legacy_migrated: _, ...rest } = data.value
        setPermissions({ ...DEFAULT_PERMISSIONS, ...rest, permissoes: ['admin'] })
      } else {
        // Dados antigos (pré-patrimônio) — usar união para não sumir novas entradas do DEFAULT
        const merged = { ...DEFAULT_PERMISSIONS }
        for (const [key, dbRoles] of Object.entries(data.value)) {
          const def = DEFAULT_PERMISSIONS[key] || []
          merged[key] = [...new Set([...def, ...dbRoles])]
        }
        setPermissions({ ...merged, permissoes: ['admin'] })
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (newPermissions, userId) => {
    // Garante que a página de permissões nunca fique acessível a não-admins.
    // _legacy_migrated marca que este JSON foi salvo após a migração — no load, confiar no DB.
    const safe = { ...newPermissions, permissoes: ['admin'], _legacy_migrated: true }
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
