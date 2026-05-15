import { createContext, useContext, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const StoreContext = createContext(null)

export const useStore = () => {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

const TTL = 60_000

export function StoreProvider({ children }) {
  // Cache em ref para não causar re-renders quando alterado.
  const cache = useRef({})

  const isFresh = (key) => {
    const entry = cache.current[key]
    return entry && Date.now() - entry.at < TTL
  }

  const fetchKey = useCallback(async (key, query) => {
    if (isFresh(key)) return cache.current[key].data
    const { data, error } = await query()
    if (error) {
      console.warn(`Store.${key} fetch falhou:`, error.message)
      return cache.current[key]?.data || []
    }
    cache.current[key] = { data: data || [], at: Date.now() }
    return cache.current[key].data
  }, [])

  const rooms = useCallback(
    () =>
      fetchKey('rooms', () =>
        supabase.from('rooms').select('id, name').is('deleted_at', null).order('name'),
      ),
    [fetchKey],
  )

  const roomsFull = useCallback(
    () =>
      fetchKey('roomsFull', () =>
        supabase.from('rooms').select('*').is('deleted_at', null).order('name'),
      ),
    [fetchKey],
  )

  const equipment = useCallback(
    () =>
      fetchKey('equipment', () =>
        supabase.from('equipment').select('id, name, categoria').is('deleted_at', null).order('name'),
      ),
    [fetchKey],
  )

  const profiles = useCallback(
    () =>
      fetchKey('profiles', () =>
        supabase.from('profiles').select('id, full_name').is('deleted_at', null),
      ),
    [fetchKey],
  )

  const invalidate = useCallback((...keys) => {
    keys.forEach((k) => {
      delete cache.current[k]
    })
  }, [])

  const clear = useCallback(() => {
    cache.current = {}
  }, [])

  return (
    <StoreContext.Provider
      value={{ rooms, roomsFull, equipment, profiles, invalidate, clear }}
    >
      {children}
    </StoreContext.Provider>
  )
}
