import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { useRealtime } from './useRealtime.js'

// Toast em tempo real de entrada/saída de equipamento da sala do coordenador.
// Baseado em equipment_locations (não asset_movements) porque é a tabela que
// TODOS os fluxos atualizam — Movimentações, Registro/Editar e Lote. Usar
// asset_movements deixava de avisar quando o equipamento era realocado
// direto pela tela de Registro (que não grava lá).
//
// Sem filtro server-side: pra detectar saída precisamos comparar
// old.current_room_id (que só vem populado com REPLICA IDENTITY FULL) com o
// new — e o Postgres Changes não permite filtrar pela linha antiga. O filtro
// é feito no cliente.
export function useRoomNotifications(user) {
  const isCoordinator = user?.role === 'coordenador'
  const roomId        = user?.coordinator_room?.id
  const [notifications, setNotifications] = useState([])
  const idRef = useRef(0)

  const buildNotif = useCallback(async (row, direction) => {
    let equipmentName = null
    if (row.equipment_id) {
      const { data } = await supabase.from('equipment').select('name').eq('id', row.equipment_id).maybeSingle()
      equipmentName = data?.name || null
    }

    let otherRoomName = null
    const otherRoomId = direction === 'in' ? row._fromRoomId : row._toRoomId
    if (otherRoomId) {
      const { data } = await supabase.from('rooms').select('name').eq('id', otherRoomId).maybeSingle()
      otherRoomName = data?.name || null
    }

    return {
      id:            ++idRef.current,
      direction,
      assetNumber:   row.asset_number || null,
      equipmentName: equipmentName || (row.asset_number ? `Patrimônio ${row.asset_number}` : 'Equipamento'),
      otherRoomName,
      movedAt:       row.moved_at || new Date().toISOString(),
    }
  }, [])

  const handleChange = useCallback(async (payload) => {
    const row = payload.new
    const prevRoomId = payload.old?.current_room_id ?? null
    if (!row) return

    if (row.current_room_id === roomId && prevRoomId !== roomId) {
      const notif = await buildNotif({ ...row, _fromRoomId: prevRoomId }, 'in')
      setNotifications((prev) => [notif, ...prev].slice(0, 8))
    } else if (prevRoomId === roomId && row.current_room_id !== roomId) {
      const notif = await buildNotif({ ...row, _toRoomId: row.current_room_id }, 'out')
      setNotifications((prev) => [notif, ...prev].slice(0, 8))
    }
  }, [roomId, buildNotif])

  useRealtime('equipment_locations', handleChange, {
    event:   '*',
    enabled: isCoordinator && !!roomId,
  })

  const dismiss  = useCallback((id) => setNotifications((prev) => prev.filter((n) => n.id !== id)), [])
  const clearAll = useCallback(() => setNotifications([]), [])

  return { notifications, dismiss, clearAll }
}
