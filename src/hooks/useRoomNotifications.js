import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { useRealtime } from './useRealtime.js'

export function useRoomNotifications(user) {
  const isCoordinator = user?.role === 'coordenador'
  const roomId        = user?.coordinator_room?.id
  const [notifications, setNotifications] = useState([])
  const idRef = useRef(0)

  const buildNotif = useCallback(async (mov, direction) => {
    let equipmentName = null
    if (mov.equipment_id) {
      const { data } = await supabase
        .from('equipment')
        .select('name')
        .eq('id', mov.equipment_id)
        .maybeSingle()
      equipmentName = data?.name || null
    }

    let otherRoomName = null
    const otherRoomId = direction === 'in' ? mov.origin_room_id : mov.destination_room_id
    if (otherRoomId) {
      const { data } = await supabase.from('rooms').select('name').eq('id', otherRoomId).maybeSingle()
      otherRoomName = data?.name || null
    }

    return {
      id:            ++idRef.current,
      movementId:    mov.id,
      direction,
      assetNumber:   mov.asset_number || null,
      equipmentName: equipmentName || (mov.asset_number ? `Patrimônio ${mov.asset_number}` : 'Equipamento'),
      receivedBy:    mov.received_by || null,
      otherRoomName,
      movedAt:       mov.moved_at || new Date().toISOString(),
    }
  }, [])

  const handleArrival = useCallback(async (payload) => {
    const mov = payload.new
    if (!mov) return
    // Guard: Supabase Realtime pode não filtrar server-side se replicação por linha não estiver ativa
    if (mov.destination_room_id !== roomId) return
    const notif = await buildNotif(mov, 'in')
    setNotifications((prev) => [notif, ...prev].slice(0, 8))
  }, [roomId, buildNotif])

  const handleDeparture = useCallback(async (payload) => {
    const mov = payload.new
    if (!mov) return
    if (mov.origin_room_id !== roomId) return
    const notif = await buildNotif(mov, 'out')
    setNotifications((prev) => [notif, ...prev].slice(0, 8))
  }, [roomId, buildNotif])

  useRealtime('asset_movements', handleArrival, {
    event:   'INSERT',
    enabled: isCoordinator && !!roomId,
    filter:  roomId ? `destination_room_id=eq.${roomId}` : undefined,
  })

  useRealtime('asset_movements', handleDeparture, {
    event:   'INSERT',
    enabled: isCoordinator && !!roomId,
    filter:  roomId ? `origin_room_id=eq.${roomId}` : undefined,
  })

  const dismiss  = useCallback((id) => setNotifications((prev) => prev.filter((n) => n.id !== id)), [])
  const clearAll = useCallback(() => setNotifications([]), [])

  return { notifications, dismiss, clearAll }
}
