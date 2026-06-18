import { useEffect, useState } from "react"
import { X, Loader2 } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { useAudit } from "../../hooks/useAudit.js"
import { applyAssetMask, formatAssetNumber, normalizeAssetNumber } from "../../utils/format.js"
import { STATUS_OPTIONS } from "../Registro.shared.jsx"

export function EditRegistroEquipmentModal({ item, roomsFetcher, equipmentFetcher, invalidate, onClose, onSaved }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [busy, setBusy] = useState(false)
  const [equipmentId, setEquipmentId] = useState(item.equipment_id || '')
  const [status, setStatus] = useState(item.status || '')
  const [observacao, setObservacao] = useState(item.observacao || '')
  const [assetNumber, setAssetNumber] = useState(item.asset_number || '')
  const [serialNumber, setSerialNumber] = useState(item.serial_number || '')
  const [roomId, setRoomId] = useState(item.current_room_id || item.destination_room_id || '')
  const [receivedBy, setReceivedBy] = useState(item.received_by || '')

  const selectedEquipment = equipment.find((eq) => eq.id === equipmentId) || null

  useEffect(() => {
    Promise.all([roomsFetcher(), equipmentFetcher()])
      .then(([rm, eq]) => {
        setRooms(rm || [])
        setEquipment(eq || [])
      })
      .catch((err) => console.error('Registro: erro ao carregar salas/equipamentos', err))
  }, [roomsFetcher, equipmentFetcher])

  useEffect(() => {
    if (!selectedEquipment) return
    setStatus(selectedEquipment.status || '')
    setObservacao(selectedEquipment.observacao || '')
  }, [selectedEquipment])

  const updateLocation = async (normalizedAsset) => {
    const payload = {
      equipment_id: equipmentId,
      asset_number: normalizedAsset || null,
      serial_number: serialNumber.trim() || null,
      current_room_id: roomId,
      received_by: receivedBy.trim() || null,
      moved_at: new Date().toISOString(),
    }

    if (item.asset_number) {
      return supabase.from('equipment_locations').update(payload).eq('asset_number', item.asset_number)
    }

    let query = supabase.from('equipment_locations').update(payload).eq('equipment_id', item.equipment_id)
    if (item.serial_number) query = query.eq('serial_number', item.serial_number)
    else query = query.is('serial_number', null)
    return query
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!equipmentId) {
      showToast('Selecione o equipamento.', 'warning')
      return
    }
    if (!roomId) {
      showToast('Selecione a localiza\u00e7\u00e3o atual.', 'warning')
      return
    }

    const normalizedAsset = normalizeAssetNumber(assetNumber)
    if (normalizedAsset && normalizedAsset !== item.asset_number) {
      const { data: existing, error: existingError } = await supabase
        .from('equipment_locations')
        .select('asset_number')
        .eq('asset_number', normalizedAsset)
        .maybeSingle()
      if (existingError) {
        showToast('Erro ao validar patrim\u00f4nio: ' + existingError.message, 'danger')
        return
      }
      if (existing) {
        showToast(`PAT ${formatAssetNumber(normalizedAsset)} j\u00e1 possui registro.`, 'warning')
        return
      }
    }

    setBusy(true)
    const equipmentUpdates = {
      status: status || null,
      observacao: observacao.trim() || null,
    }
    const { error: equipmentError } = await supabase
      .from('equipment')
      .update(equipmentUpdates)
      .eq('id', equipmentId)

    if (equipmentError) {
      showToast('Erro ao atualizar equipamento: ' + equipmentError.message, 'danger')
      setBusy(false)
      return
    }

    const { error: locationError } = await updateLocation(normalizedAsset)
    if (locationError) {
      showToast('Equipamento atualizado, mas houve erro ao atualizar o registro: ' + locationError.message, 'warning')
      setBusy(false)
      return
    }

    invalidate('equipment')
    audit.updated('equipment', equipmentId, {
      previous: {
        equipment_id: item.equipment_id || null,
        name: item.equipment?.name || null,
        categoria: item.categoria || null,
        status: item.equipment_id === equipmentId ? item.status || null : selectedEquipment?.status || null,
        observacao: item.equipment_id === equipmentId ? item.observacao || null : selectedEquipment?.observacao || null,
        asset_number: item.asset_number || null,
        serial_number: item.serial_number || null,
        current_room_id: item.current_room_id || item.destination_room_id || null,
      },
      next: {
        equipment_id: equipmentId,
        name: selectedEquipment?.name || null,
        categoria: selectedEquipment?.categoria || null,
        status: equipmentUpdates.status,
        observacao: equipmentUpdates.observacao,
        asset_number: normalizedAsset || null,
        serial_number: serialNumber.trim() || null,
        current_room_id: roomId,
      },
    })
    showToast('Equipamento atualizado com sucesso!', 'success')
    setBusy(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>Editar equipamento</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nome do equipamento <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-control" required value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
              <option value="">Selecione...</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Categoria</label>
              <input type="text" className="form-control" value={selectedEquipment?.categoria || ''} readOnly placeholder="Selecione um equipamento" />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Sem status</option>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>{'N\u00ba Patrim\u00f4nio'}</label>
              <input type="text" className="form-control" value={assetNumber} onChange={(e) => setAssetNumber(applyAssetMask(e.target.value))} placeholder="000.000.000.000" />
            </div>
            <div className="form-group">
              <label>{'N\u00ba S\u00e9rie'}</label>
              <input type="text" className="form-control" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>{'Localiza\u00e7\u00e3o atual'} <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select className="form-control" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Selecione...</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{'Com quem est\u00e1'}</label>
              <input type="text" className="form-control" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>{'Observa\u00e7\u00e3o'}</label>
            <textarea className="form-control" rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Salvar altera\u00e7\u00f5es'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
