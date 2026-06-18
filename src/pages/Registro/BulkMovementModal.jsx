import { useEffect, useState, useMemo } from "react"
import { X } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useStore } from "../../contexts/StoreContext.jsx"
import { useToast } from "../../contexts/ToastContext.jsx"
import { useAudit } from "../../hooks/useAudit.js"
import { formatAssetNumber } from "../../utils/format.js"
import { STATUS_OPTIONS } from "../Registro.shared.jsx"

export function BulkMovementModal({ items, user, onClose, onSuccess }) {
  const { rooms: roomsFetcher, invalidate } = useStore()
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [destRoomId, setDestRoomId] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [itemStatus, setItemStatus] = useState('')
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    roomsFetcher().then(setRooms).catch((err) => console.error('Registro: erro ao carregar salas', err))
  }, [roomsFetcher])

  const skippable = useMemo(
    () => items.filter((i) => destRoomId && i.destination_room_id === destRoomId),
    [items, destRoomId],
  )
  const movableItems = useMemo(
    () => items.filter((i) => destRoomId && i.destination_room_id !== destRoomId),
    [items, destRoomId],
  )
  const destRoom = useMemo(() => rooms.find((r) => r.id === destRoomId), [rooms, destRoomId])

  const updateLocation = async (item, movedAt, receiver) => {
    const payload = {
      equipment_id: item.equipment_id,
      asset_number: item.asset_number,
      serial_number: item.serial_number,
      current_room_id: destRoomId,
      received_by: receiver,
      moved_at: movedAt,
    }

    if (item.asset_number) {
      return supabase.from('equipment_locations').upsert(payload, { onConflict: 'asset_number' })
    }

    let query = supabase
      .from('equipment_locations')
      .update({ current_room_id: destRoomId, received_by: receiver, moved_at: movedAt })
      .eq('equipment_id', item.equipment_id)
    if (item.serial_number) query = query.eq('serial_number', item.serial_number)
    else query = query.is('serial_number', null)
    return query
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!destRoomId) {
      showToast('Selecione a sala de destino.', 'warning')
      return
    }
    if (movableItems.length === 0) {
      showToast('Todos os selecionados j\u00e1 est\u00e3o nessa sala.', 'warning')
      return
    }

    setSubmitting(true)
    const movedAt = new Date().toISOString()
    const receiver = receivedBy.trim() || null
    const inserts = movableItems.map((item) => ({
      equipment_id: item.equipment_id,
      serial_number: item.serial_number || null,
      asset_number: item.asset_number || null,
      origin_room_id: item.destination_room_id || item.current_room_id || null,
      destination_room_id: destRoomId,
      moved_by: user?.id || null,
      received_by: receiver,
      received_by_profile_id: null,
      moved_at: movedAt,
      item_status: itemStatus || null,
      comentario: comentario.trim() || null,
    }))

    const { data: inserted, error } = await supabase.from('asset_movements').insert(inserts).select('id')
    if (error) {
      showToast('Erro ao registrar movimenta\u00e7\u00f5es: ' + error.message, 'danger')
      setSubmitting(false)
      return
    }

    // Itens com asset_number: batch upsert em uma única chamada
    const withAsset = movableItems.filter((i) => i.asset_number)
    const withoutAsset = movableItems.filter((i) => !i.asset_number)

    if (withAsset.length > 0) {
      const upsertPayload = withAsset.map((item) => ({
        equipment_id: item.equipment_id,
        asset_number: item.asset_number,
        serial_number: item.serial_number || null,
        current_room_id: destRoomId,
        received_by: receiver ?? item.received_by ?? null,
        moved_at: movedAt,
      }))
      const { error: upsertError } = await supabase
        .from('equipment_locations')
        .upsert(upsertPayload, { onConflict: 'asset_number' })
      if (upsertError) {
        showToast('Movimenta\u00e7\u00f5es criadas, mas houve erro ao atualizar o Registro: ' + upsertError.message, 'warning')
        setSubmitting(false)
        return
      }
    }

    // Itens sem asset_number: atualização individual (chave composta, não pode agrupar)
    for (const item of withoutAsset) {
      let query = supabase
        .from('equipment_locations')
        .update({ current_room_id: destRoomId, received_by: receiver ?? item.received_by ?? null, moved_at: movedAt })
        .eq('equipment_id', item.equipment_id)
      query = item.serial_number ? query.eq('serial_number', item.serial_number) : query.is('serial_number', null)
      const { error: locationError } = await query
      if (locationError) {
        showToast('Movimenta\u00e7\u00f5es criadas, mas houve erro ao atualizar o Registro: ' + locationError.message, 'warning')
        setSubmitting(false)
        return
      }
    }

    if (itemStatus) {
      const equipmentIds = [...new Set(movableItems.map((i) => i.equipment_id).filter(Boolean))]
      if (equipmentIds.length > 0) {
        const { error: statusError } = await supabase.from('equipment').update({ status: itemStatus }).in('id', equipmentIds)
        if (statusError) {
          showToast('Movimenta\u00e7\u00f5es registradas, mas houve erro ao atualizar o status: ' + statusError.message, 'warning')
          setSubmitting(false)
          return
        }
        invalidate('equipment')
      }
    }

    audit.log('bulk_movement_from_register', 'asset_movements', null, {
      count: inserts.length,
      destination: destRoom?.name,
      movement_ids: (inserted || []).map((r) => r.id),
      asset_numbers: inserts.map((m) => m.asset_number).filter(Boolean),
    })
    showToast(
      `${inserts.length} movimenta\u00e7${inserts.length !== 1 ? '\u00f5es criadas' : '\u00e3o criada'} para "${destRoom?.name}".`,
      'success',
    )
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h3>Movimentar {items.length} {items.length === 1 ? 'item' : 'itens'}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {'Cria movimenta\u00e7\u00f5es e atualiza a sala atual dos equipamentos selecionados.'}
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Sala de destino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-control" required value={destRoomId} onChange={(e) => setDestRoomId(e.target.value)}>
              <option value="">Selecione...</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {skippable.length > 0 && (
              <small style={{ color: 'var(--warning-color)', fontSize: 12, marginTop: 4, display: 'block' }}>
                {skippable.length} {skippable.length === 1 ? 'item j\u00e1 est\u00e1' : 'itens j\u00e1 est\u00e3o'} nessa sala e {skippable.length === 1 ? 'ser\u00e1 pulado' : 'ser\u00e3o pulados'}.
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Recebedor</label>
            <input type="text" className="form-control" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Nome de quem recebeu... (vazio = manter atual no Registro)" />
          </div>

          <div className="form-group">
            <label>Status do item</label>
            <select className="form-control" value={itemStatus} onChange={(e) => setItemStatus(e.target.value)}>
              <option value="">{'N\u00e3o alterar'}</option>
              {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>{'Coment\u00e1rio'}</label>
            <textarea className="form-control" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder={'Observa\u00e7\u00e3o opcional da movimenta\u00e7\u00e3o...'} />
          </div>

          <div style={{ maxHeight: 190, overflowY: 'auto', background: 'var(--bg-hover)', borderRadius: 8, padding: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              {'Movimenta\u00e7\u00f5es que ser\u00e3o criadas'} ({movableItems.length})
            </div>
            {items.map((i) => {
              const willSkip = destRoomId && i.destination_room_id === destRoomId
              return (
                <div key={i.key} style={{ fontSize: 13, padding: '5px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.equipment?.name || '\u2014'}
                      {i.asset_number && <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 12 }}>{formatAssetNumber(i.asset_number)}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: willSkip ? 'var(--warning-color)' : 'var(--text-secondary)', marginTop: 1 }}>
                      {willSkip ? 'ser\u00e1 pulado' : `${i.room?.name || '\u2014'} \u2192 ${destRoom?.name || 'destino'}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={submitting || movableItems.length === 0}>
              {submitting ? 'Movimentando...' : `Criar ${movableItems.length} movimenta\u00e7${movableItems.length !== 1 ? '\u00f5es' : '\u00e3o'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
