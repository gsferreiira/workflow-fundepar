// Detecta equipamentos novos na sala do coordenador — tanto via movimentação
// quanto via cadastro em lote (Registro/Lote só grava em equipment_locations,
// não em asset_movements, por isso a query usa essa tabela).
// Roda no Layout (global) para disparar o modal em qualquer página, não só
// no mount do Dashboard do setor — e escuta Realtime para pegar entradas
// que aconteçam enquanto o coordenador já está logado.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useRealtime } from './useRealtime.js'

export function useNewRoomEquipment(user) {
  const isCoordinator = user?.role === 'coordenador'
  const roomId = user?.coordinator_room?.id
  const storageKey = user?.id && roomId ? `coord_last_seen_${user.id}_${roomId}` : null
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!isCoordinator || !roomId || !storageKey) { setItems([]); return undefined }
    let cancelled = false
    const since = localStorage.getItem(storageKey)
      || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    supabase
      .from('equipment_locations')
      .select('id, moved_at, asset_number, equipment_id, equipment(name)')
      .eq('current_room_id', roomId)
      .gte('moved_at', since)
      .order('moved_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return
        setItems(data)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [isCoordinator, roomId, storageKey])

  const handleChange = useCallback(async (payload) => {
    const row = payload.new
    if (!row || row.current_room_id !== roomId) return
    let equipmentName = null
    if (row.equipment_id) {
      const { data } = await supabase.from('equipment').select('name').eq('id', row.equipment_id).maybeSingle()
      equipmentName = data?.name || null
    }
    setItems((prev) => {
      if (prev.some((i) => i.id === row.id)) return prev
      return [{
        id: row.id,
        moved_at: row.moved_at,
        asset_number: row.asset_number,
        equipment_id: row.equipment_id,
        equipment: { name: equipmentName },
      }, ...prev].slice(0, 20)
    })
  }, [roomId])

  useRealtime('equipment_locations', handleChange, {
    event: '*',
    enabled: isCoordinator && !!roomId,
    filter: roomId ? `current_room_id=eq.${roomId}` : undefined,
  })

  const dismiss = useCallback(() => {
    if (storageKey) localStorage.setItem(storageKey, new Date().toISOString())
    setItems([])
  }, [storageKey])

  return { items, dismiss }
}
