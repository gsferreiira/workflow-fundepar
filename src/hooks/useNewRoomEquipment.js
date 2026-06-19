// Detecta equipamentos novos na sala do coordenador desde a última vez que ele
// dispensou o aviso — tanto via movimentação quanto via cadastro em lote
// (Registro/Lote só grava em equipment_locations, não em asset_movements, por
// isso a query usa essa tabela). Roda no Layout (global) para disparar o
// modal em qualquer página, não só no mount do Dashboard do setor.
//
// Só faz a checagem inicial (catch-up) — não escuta Realtime. Entradas que
// aconteçam com o coordenador já logado já são avisadas pelo toast
// (useRoomNotifications); ter os dois reagindo ao mesmo evento ao vivo
// duplicaria o aviso (modal + toast simultâneos).
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

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

  const dismiss = () => {
    if (storageKey) localStorage.setItem(storageKey, new Date().toISOString())
    setItems([])
  }

  return { items, dismiss }
}
