import { useCallback, useEffect, useState, useMemo } from "react"
import { X, UserMinus } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useStore } from "../../contexts/StoreContext.jsx"
import { useToast } from "../../contexts/ToastContext.jsx"
import { useAudit } from "../../hooks/useAudit.js"
import { formatAssetNumber } from "../../utils/format.js"
import { STATUS_OPTIONS } from "../Registro.shared.jsx"

export function BulkMoveModal({ items, onClose, onSuccess }) {
  const { rooms: roomsFetcher, equipment: equipmentFetcher, invalidate } = useStore()
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [destRoomId, setDestRoomId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  // receivedBy: texto para sobrescrever todos; clearReceiver: remove o recebedor de todos
  const [receivedBy, setReceivedBy] = useState('')
  const [clearReceiver, setClearReceiver] = useState(false)
  const [itemStatus, setItemStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([roomsFetcher(), equipmentFetcher()])
      .then(([rm, eq]) => {
        setRooms(rm || [])
        setEquipment(eq || [])
      })
      .catch((err) => console.error('Registro: erro ao carregar salas/equipamentos', err))
  }, [roomsFetcher, equipmentFetcher])

  const skippable = useMemo(
    () => items.filter((i) => destRoomId && i.destination_room_id === destRoomId),
    [items, destRoomId],
  )
  const selectedEquipment = useMemo(
    () => equipment.find((eq) => eq.id === equipmentId) || null,
    [equipment, equipmentId],
  )
  const hasReceiverChange = clearReceiver || !!receivedBy.trim()
  const hasEquipmentChange = !!equipmentId
  const needsRegisterUpdate = useCallback(
    (item) =>
      (destRoomId && item.destination_room_id !== destRoomId) ||
      hasEquipmentChange ||
      hasReceiverChange,
    [destRoomId, hasEquipmentChange, hasReceiverChange],
  )
  const toUpdate = useMemo(
    () => items.filter(needsRegisterUpdate).length,
    [items, needsRegisterUpdate],
  )

  // Recebedor resultante por item:
  //   clearReceiver → null
  //   receivedBy preenchido → novo valor para todos
  //   senão → mantém o existente de cada item
  const resolveReceiver = (item) => {
    if (clearReceiver) return null
    if (receivedBy.trim()) return receivedBy.trim()
    return item.received_by || null
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!destRoomId && !equipmentId && !itemStatus && !hasReceiverChange) {
      showToast('Informe ao menos uma alteracao para atualizar o registro.', 'warning')
      return
    }
    if (destRoomId && toUpdate === 0 && !itemStatus) {
      showToast('Todos os selecionados ja estao nessa sala.', 'warning')
      return
    }
    setSubmitting(true)
    const movedAt = new Date().toISOString()
    const destRoom = rooms.find((r) => r.id === destRoomId)

    const records = items
      .filter(needsRegisterUpdate)
      .map((i) => ({
        original_equipment_id: i.equipment_id,
        original_serial_number: i.serial_number,
        equipment_id: equipmentId || i.equipment_id,
        serial_number: i.serial_number,
        asset_number: i.asset_number,
        current_room_id: destRoomId || i.destination_room_id,
        received_by: resolveReceiver(i),
        moved_at: movedAt,
      }))

    // Itens com asset_number: batch upsert em uma única chamada
    const withAsset = records.filter((r) => r.asset_number)
    const withoutAsset = records.filter((r) => !r.asset_number)

    if (withAsset.length > 0) {
      const upsertPayload = withAsset.map((r) => ({
        equipment_id: r.equipment_id,
        asset_number: r.asset_number,
        serial_number: r.serial_number,
        current_room_id: r.current_room_id,
        received_by: r.received_by,
        moved_at: r.moved_at,
      }))
      const { error } = await supabase
        .from('equipment_locations')
        .upsert(upsertPayload, { onConflict: 'asset_number' })
      if (error) {
        showToast('Erro ao atualizar registro: ' + error.message, 'danger')
        setSubmitting(false)
        return
      }
    }

    // Itens sem asset_number: atualização individual (chave composta, não pode agrupar)
    for (const record of withoutAsset) {
      const payload = {
        equipment_id: record.equipment_id,
        serial_number: record.serial_number,
        current_room_id: record.current_room_id,
        received_by: record.received_by,
        moved_at: record.moved_at,
      }
      let query = supabase
        .from('equipment_locations')
        .update(payload)
        .eq('equipment_id', record.original_equipment_id)
      query = record.original_serial_number
        ? query.eq('serial_number', record.original_serial_number)
        : query.is('serial_number', null)
      const { error } = await query
      if (error) {
        showToast('Erro ao atualizar registro: ' + error.message, 'danger')
        setSubmitting(false)
        return
      }
    }

    if (itemStatus) {
      const equipmentIds = equipmentId
        ? [equipmentId]
        : [...new Set(items.map((i) => i.equipment_id).filter(Boolean))]
      if (equipmentIds.length > 0) {
        const { error: statusError } = await supabase
          .from('equipment')
          .update({ status: itemStatus })
          .in('id', equipmentIds)
        if (statusError) {
          showToast('Registro atualizado, mas houve erro ao atualizar o status: ' + statusError.message, 'warning')
          setSubmitting(false)
          return
        }
        invalidate('equipment')
      }
    }

    audit.log('bulk_register_update', 'equipment_locations', null, {
      count: records.length,
      destination: destRoom?.name || null,
      equipment: selectedEquipment?.name || null,
      status: itemStatus || null,
      asset_numbers: records.map((m) => m.asset_number).filter(Boolean),
    })

    const messages = []
    if (records.length > 0) {
      const target = destRoom?.name ? ` para "${destRoom.name}"` : ''
      messages.push(`${records.length} ${records.length === 1 ? 'registro atualizado' : 'registros atualizados'}${target}`)
    }
    if (selectedEquipment) {
      messages.push(`equipamento alterado para "${selectedEquipment.name}"`)
    }
    if (itemStatus) {
      messages.push(`status atualizado para "${STATUS_OPTIONS.find((s) => s.value === itemStatus)?.label || itemStatus}"`)
    }
    showToast(`${messages.join(' e ')}.`, 'success')
    onSuccess()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <h3>Atualizar {items.length} {items.length === 1 ? 'registro' : 'registros'}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Os itens selecionados terão a localização atual atualizada sem gerar movimentação.
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Localização atual</label>
            <select
              className="form-control"
              value={destRoomId}
              onChange={(e) => setDestRoomId(e.target.value)}
            >
              <option value="">Não alterar</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {skippable.length > 0 && (
              <small style={{ color: 'var(--warning-color)', fontSize: 12, marginTop: 4, display: 'block' }}>
                {skippable.length} {skippable.length === 1 ? 'item já está' : 'itens já estão'} nessa sala e {skippable.length === 1 ? 'será pulado' : 'serão pulados'}.
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Equipamento</label>
            <select
              className="form-control"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              <option value="">Não alterar</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </select>
            <small style={{ display: 'block', marginTop: 4, color: 'var(--text-secondary)' }}>
              Atualiza o tipo/modelo vinculado aos patrimônios selecionados sem criar movimentação.
            </small>
          </div>

          <div className="form-group">
            <label>Recebedor</label>
            {clearReceiver ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 8,
              }}>
                <UserMinus size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#dc2626', flex: 1 }}>
                  Recebedor será removido de todos os equipamentos
                </span>
                <button
                  type="button"
                  onClick={() => setClearReceiver(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, display: 'flex' }}
                  title="Cancelar redefinição"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="form-control"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Trocar recebedor de todos... (vazio = manter atual)"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => { setReceivedBy(''); setClearReceiver(true) }}
                  title="Redefinir — remove o recebedor de todos os equipamentos"
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                    padding: '0 12px', border: '1px solid rgba(239,68,68,.35)',
                    borderRadius: 8, background: 'rgba(239,68,68,.04)',
                    color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <UserMinus size={13} /> Redefinir
                </button>
              </div>
            )}
            {!clearReceiver && !receivedBy && (
              <small style={{ display: 'block', marginTop: 4, color: 'var(--text-secondary)' }}>
                Se deixar vazio, cada equipamento mantém seu recebedor atual.
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Status do item</label>
            <select
              className="form-control"
              value={itemStatus}
              onChange={(e) => setItemStatus(e.target.value)}
            >
              <option value="">Não alterar</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <small style={{ display: 'block', marginTop: 4, color: 'var(--text-secondary)' }}>
              Se selecionar um status, ele sera aplicado aos equipamentos selecionados.
            </small>
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg-hover)', borderRadius: 8, padding: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Itens selecionados ({items.length})
            </div>
            {items.map((i) => {
              const resultReceiver = resolveReceiver(i)
              const keepingExisting = !clearReceiver && !receivedBy.trim() && i.received_by
              return (
                <div
                  key={i.key}
                  style={{
                    fontSize: 13,
                    padding: '5px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.equipment?.name || '—'}
                      {i.asset_number && (
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 12 }}>
                          {formatAssetNumber(i.asset_number)}
                        </span>
                      )}
                    </div>
                    {resultReceiver ? (
                      <div style={{ fontSize: 11, color: keepingExisting ? '#0284c7' : '#059669', marginTop: 1 }}>
                        {keepingExisting ? '↪ mantendo: ' : '→ '}{resultReceiver}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>sem recebedor</div>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {i.room?.name || '—'}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#e2e8f0', color: '#475569' }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || (toUpdate === 0 && !itemStatus)}>
              {submitting
                ? 'Atualizando...'
                : itemStatus && toUpdate === 0
                  ? `Atualizar status de ${items.length}`
                  : `Atualizar ${toUpdate} ${toUpdate === 1 ? 'registro' : 'registros'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
