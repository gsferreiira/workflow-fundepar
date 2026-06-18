import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useStore } from "../../contexts/StoreContext.jsx"
import { useToast } from "../../contexts/ToastContext.jsx"
import { formatAssetNumber, applyAssetMask, toDateTimeLocalValue, dateTimeLocalValueToIso } from "../../utils/format.js"
import { EQUIPMENT_STATUS_OPTIONS, ReceiverSelect } from "../Movimentacoes.shared.jsx"

export function EditModal({ mov, equipment, rooms, profilesList, user, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const { invalidate } = useStore()
  const [busy, setBusy] = useState(false)
  const [eqId, setEqId] = useState(mov.equipment_id || '')
  const [eqName, setEqName] = useState(mov.equipment?.name || '')
  const [originId, setOriginId] = useState(mov.origin_room_id || '')
  const [originName, setOriginName] = useState(mov.origin?.name || '')
  const [destId, setDestId] = useState(mov.destination_room_id || '')
  const [destName, setDestName] = useState(mov.destination?.name || '')
  const [serial, setSerial] = useState(mov.serial_number || '')
  const [asset, setAsset] = useState(formatAssetNumber(mov.asset_number) || '')
  const [receivedBy, setReceivedBy] = useState(mov.received_by || '')
  const [receivedByProfileId, setReceivedByProfileId] = useState(mov.received_by_profile_id || '')
  const [itemStatus, setItemStatus] = useState(mov.item_status || '')
  const [movedAt, setMovedAt] = useState(toDateTimeLocalValue(mov.moved_at))
  const [editReason, setEditReason] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!eqId) { showToast('Selecione um equipamento da lista.', 'warning'); return }
    if (!originId) { showToast('Selecione a sala de origem.', 'warning'); return }
    if (!destId) { showToast('Selecione a sala de destino.', 'warning'); return }
    if (originId === destId) { showToast('Origem e destino não podem ser iguais.', 'warning'); return }
    if (!editReason.trim()) { showToast('A justificativa é obrigatória.', 'warning'); return }

    setBusy(true)
    const digits = asset.replace(/\D/g, '')
    const assetNumber =
      digits.length === 12
        ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
        : asset || null

    const { error } = await supabase
      .from('asset_movements')
      .update({
        equipment_id: eqId,
        serial_number: serial || null,
        asset_number: assetNumber,
        origin_room_id: originId,
        destination_room_id: destId,
        received_by: receivedBy || null,
        received_by_profile_id: receivedByProfileId || null,
        item_status: itemStatus || null,
        moved_at: dateTimeLocalValueToIso(movedAt) || undefined,
        is_edited: true,
        edited_by: user.id,
        edited_at: new Date().toISOString(),
        edit_reason: editReason.trim(),
      })
      .eq('id', mov.id)

    if (error) {
      showToast('Erro ao atualizar: ' + error.message, 'danger')
      setBusy(false)
      return
    }

    if (itemStatus) {
      const { error: statusError } = await supabase
        .from('equipment')
        .update({ status: itemStatus })
        .eq('id', eqId)
      if (statusError) {
        showToast('Movimentação atualizada, mas houve erro ao atualizar o status: ' + statusError.message, 'warning')
      }
    }

    if (itemStatus) invalidate('equipment')

    await supabase.from('movement_edits').insert([{
      movement_id: mov.id,
      edited_by: user.id,
      edited_at: new Date().toISOString(),
      edit_reason: editReason.trim(),
    }])

    audit.updated('asset_movements', mov.id, { reason: editReason.trim() })
    showToast('Movimentação atualizada!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>Editar Movimentação</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Equipamento <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select
              className="form-control"
              value={eqId}
              onChange={(e) => {
                setEqId(e.target.value)
                setEqName(e.target.selectedOptions[0]?.textContent || '')
              }}
              required
            >
              <option value="">Selecione...</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Origem <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select
                className="form-control"
                value={originId}
                onChange={(e) => {
                  setOriginId(e.target.value)
                  setOriginName(e.target.selectedOptions[0]?.textContent || '')
                }}
                required
              >
                <option value="">Selecione...</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Destino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select
                className="form-control"
                value={destId}
                onChange={(e) => {
                  setDestId(e.target.value)
                  setDestName(e.target.selectedOptions[0]?.textContent || '')
                }}
                required
              >
                <option value="">Selecione...</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Nº Série</label>
              <input type="text" className="form-control" value={serial}
                onChange={(e) => setSerial(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Nº Patrimônio</label>
              <input type="text" className="form-control" value={asset}
                onChange={(e) => setAsset(applyAssetMask(e.target.value))} />
            </div>
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Recebedor</label>
              <ReceiverSelect
                profiles={profilesList}
                profileId={receivedByProfileId}
                text={receivedBy}
                onProfileChange={(id, name) => { setReceivedByProfileId(id); setReceivedBy(name) }}
                onTextChange={(t) => setReceivedBy(t)}
              />
            </div>
            <div className="form-group">
              <label>Data / Hora</label>
              <input type="datetime-local" className="form-control" value={movedAt}
                onChange={(e) => setMovedAt(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Status do item</label>
            <select className="form-control" value={itemStatus}
              onChange={(e) => setItemStatus(e.target.value)}>
              <option value="">Não alterar</option>
              {EQUIPMENT_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Justificativa da edição <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <textarea className="form-control" rows={2} required value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Descreva o motivo da alteração..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
