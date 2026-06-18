import { useEffect, useState } from "react"
import { X, Loader2 } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { useAudit } from "../../hooks/useAudit.js"
import { formatAssetNumber } from "../../utils/format.js"
import { STATUS_OPTIONS, isPrinterEquipment } from "../Registro.shared.jsx"

export function NewRegistroModal({ assetNumber, roomsFetcher, equipmentFetcher, invalidate, onClose, onSaved }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [busy, setBusy] = useState(false)
  const [eqId, setEqId] = useState('')
  const [eqName, setEqName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [serial, setSerial] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([roomsFetcher(), equipmentFetcher()])
      .then(([rm, eq]) => {
        setRooms(rm || [])
        setEquipment(eq || [])
      })
      .catch((err) => console.error('Registro: erro ao carregar salas/equipamentos', err))
  }, [roomsFetcher, equipmentFetcher])

  const submit = async (e) => {
    e.preventDefault()
    if (!eqId) { showToast('Selecione o equipamento.', 'warning'); return }
    if (!roomId) { showToast('Selecione a localização atual.', 'warning'); return }

    setBusy(true)
    const movedAt = new Date().toISOString()
    const selectedEquipment = equipment.find((eq) => eq.id === eqId) || null
    const { error } = await supabase
      .from('equipment_locations')
      .upsert({
        equipment_id: eqId,
        asset_number: assetNumber,
        serial_number: serial || null,
        received_by: receivedBy || null,
        current_room_id: roomId,
        moved_at: movedAt,
      }, { onConflict: 'asset_number' })

    if (error) {
      showToast('Erro ao salvar registro: ' + error.message, 'danger')
      setBusy(false)
      return
    }

    if (status) {
      const { error: statusError } = await supabase.from('equipment').update({ status }).eq('id', eqId)
      if (statusError) {
        showToast('Registro salvo, mas houve erro ao atualizar o status: ' + statusError.message, 'warning')
        setBusy(false)
        return
      }
      invalidate('equipment')
    }

    audit.created('equipment_locations', assetNumber, { asset_number: assetNumber, equipment_id: eqId, current_room_id: roomId })
    showToast('Registro criado com sucesso!', 'success')
    onSaved({
      assetNumber,
      equipmentId: eqId,
      equipmentName: selectedEquipment?.name || eqName || null,
      roomId,
      isPrinter: isPrinterEquipment(selectedEquipment),
    })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h3>Novo Registro</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              PAT: <strong>{formatAssetNumber(assetNumber)}</strong>
            </div>
          </div>
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
              <label>Localização atual <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select className="form-control" value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
                <option value="">Selecione...</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nº Série</label>
              <input type="text" className="form-control" value={serial} onChange={(e) => setSerial(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Com quem está</label>
            <input type="text" className="form-control" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Status do item</label>
            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Não alterar</option>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Salvar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
