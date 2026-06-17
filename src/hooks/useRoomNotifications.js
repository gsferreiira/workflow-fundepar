import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { useRealtime } from './useRealtime.js'

export function useRoomNotifications(user) {
  const isCoordinator = user?.role === 'coordenador'
  const roomId        = user?.coordinator_room?.id
  const [notifications, setNotifications] = useState([])
  const idRef = useRef(0)

  const handleInsert = useCallback(async (payload) => {
    const mov = payload.new
    if (!mov) return
    // Guard: Supabase Realtime pode não filtrar server-side se replicação por linha não estiver ativa
    if (mov.destination_room_id !== roomId) return

    let equipmentName = null
    if (mov.equipment_id) {
      const { data } = await supabase
        .from('equipment')
        .select('name')
        .eq('id', mov.equipment_id)
        .maybeSingle()
      equipmentName = data?.name || null
    }

    const notif = {
      id:            ++idRef.current,
      movementId:    mov.id,
      assetNumber:   mov.asset_number || null,
      equipmentName: equipmentName || (mov.asset_number ? `Patrimônio ${mov.asset_number}` : 'Equipamento'),
      receivedBy:    mov.received_by || null,
      movedAt:       mov.moved_at || new Date().toISOString(),
    }

    setNotifications((prev) => [notif, ...prev].slice(0, 8))
  }, [])

  useRealtime('asset_movements', handleInsert, {
    event:   'INSERT',
    enabled: isCoordinator && !!roomId,
    filter:  roomId ? `destination_room_id=eq.${roomId}` : undefined,
  })

  const dismiss  = useCallback((id) => setNotifications((prev) => prev.filter((n) => n.id !== id)), [])
  const clearAll = useCallback(() => setNotifications([]), [])

  return { notifications, dismiss, clearAll }
}
