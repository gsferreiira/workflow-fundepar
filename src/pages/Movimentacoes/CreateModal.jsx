import { useEffect, useState } from "react"
import { X, Loader2, ScanLine } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase.js"
import { useStore } from "../../contexts/StoreContext.jsx"
import { useToast } from "../../contexts/ToastContext.jsx"
import { Scanner } from "../../components/Scanner.jsx"
import { normalizeAssetNumber, applyAssetMask } from "../../utils/format.js"
import { EQUIPMENT_STATUS_OPTIONS, ReceiverSelect } from "../Movimentacoes.shared.jsx"

export function CreateModal({ equipment, rooms, profilesList, user, prefill, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const { invalidate } = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [destId, setDestId] = useState('')
  const [destName, setDestName] = useState('')
  const [serial, setSerial] = useState('')
  const [asset, setAsset] = useState(prefill?.asset || '')
  const [receivedBy, setReceivedBy] = useState('')
  const [receivedByProfileId, setReceivedByProfileId] = useState('')
  const [itemStatus, setItemStatus] = useState('')
  const [comentario, setComentario] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  // Sugere automaticamente o coordenador da sala de destino como recebedor.
  useEffect(() => {
    if (!destId) return
    const room = rooms.find((r) => r.id === destId)
    if (room?.coordinator_id) {
      setReceivedByProfileId(room.coordinator_id)
      setReceivedBy(room.coordinator || '')
    }
  }, [destId, rooms])

  const submit = async (e) => {
    e.preventDefault()
    if (!destId) { showToast('Selecione a sala de destino.', 'warning'); return }

    const assetNumber = normalizeAssetNumber(asset)
    if (!assetNumber) {
      showToast('Informe o Nº Patrimônio.', 'warning')
      return
    }

    const { data: registration, error: regError } = await supabase
      .from('equipment_locations')
      .select('equipment_id, serial_number, current_room_id')
      .eq('asset_number', assetNumber)
      .maybeSingle()
    if (regError) {
      showToast('Erro ao verificar registro: ' + regError.message, 'danger')
      return
    }
    if (!registration?.equipment_id) {
      showToast('Patrimônio não registrado. Cadastre o equipamento antes de movimentar.', 'warning')
      navigate('/registro', { state: { newRegistroAsset: assetNumber } })
      return
    }

    const eqId = registration.equipment_id
    const serialNumber = serial || registration.serial_number || null
    const originRoomId = registration.current_room_id
    const originRoom = rooms.find((room) => room.id === originRoomId)
    if (!originRoomId) {
      showToast('Este patrimônio não possui localização atual no Registro.', 'warning')
      return
    }

    if (originRoomId === destId) {
      if (assetNumber) {
        const { data: lastMov } = await supabase
          .from('asset_movements')
          .select('id')
          .eq('asset_number', assetNumber)
          .is('deleted_at', null)
          .limit(1)
        if (lastMov && lastMov.length > 0) {
          showToast('A sala de origem e destino não podem ser iguais.', 'warning')
          return
        }
      } else {
        showToast('A sala de origem e destino não podem ser iguais.', 'warning')
        return
      }
    }

    if (assetNumber) {
      const { data: lastMov } = await supabase
        .from('asset_movements')
        .select('destination_room_id')
        .eq('asset_number', assetNumber)
        .is('deleted_at', null)
        .order('moved_at', { ascending: false })
        .limit(1)
      if (lastMov && lastMov.length > 0 && lastMov[0].destination_room_id === destId) {
        showToast('Este patrimônio já está na sala de destino selecionada.', 'warning')
        return
      }
    }

    setBusy(true)
    const movedAt = new Date().toISOString()
    const { data: inserted, error } = await supabase
      .from('asset_movements')
      .insert([{
        equipment_id: eqId,
        serial_number: serialNumber,
        asset_number: assetNumber,
        origin_room_id: originRoomId,
        destination_room_id: destId,
        moved_by: user.id,
        received_by: receivedBy || null,
        received_by_profile_id: receivedByProfileId || null,
        moved_at: movedAt,
        item_status: itemStatus || null,
        comentario: comentario || null,
      }])
      .select('id')
      .single()
    if (error) {
      showToast('Erro ao registrar: ' + error.message, 'danger')
      setBusy(false)
      return
    }
    if (itemStatus) {
      const { error: statusError } = await supabase
        .from('equipment')
        .update({ status: itemStatus })
        .eq('id', eqId)
      if (statusError) {
        showToast('Movimentação registrada, mas houve erro ao atualizar o status: ' + statusError.message, 'warning')
        setBusy(false)
        return
      }
      invalidate('equipment')
    }
    if (assetNumber) {
      await supabase.from('equipment_locations').upsert(
        { equipment_id: eqId, asset_number: assetNumber, serial_number: serialNumber, current_room_id: destId, moved_at: movedAt },
        { onConflict: 'asset_number' },
      )
    }
    audit.created('asset_movements', inserted?.id, { equipment_id: eqId, asset_number: assetNumber, from: originRoom?.name || originRoomId, to: destName })
    showToast('Movimentação registrada!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3>Nova Movimentação</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
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
          <div className="form-2col">
            <div className="form-group">
              <label>Nº Série</label>
              <input type="text" className="form-control" value={serial}
                onChange={(e) => setSerial(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="form-group">
              <label>Nº Patrimônio</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" className="form-control" value={asset}
                  onChange={(e) => setAsset(applyAssetMask(e.target.value))}
                  placeholder="000.000.000.000"
                  style={{ flex: 1 }} />
                <button type="button" className="btn-scanner" onClick={() => setScannerOpen(true)}>
                  <ScanLine size={14} /> Scanner
                </button>
              </div>
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
              <label>Status do item</label>
              <select className="form-control" value={itemStatus}
                onChange={(e) => setItemStatus(e.target.value)}>
                <option value="">Não alterar</option>
                {EQUIPMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Comentário</label>
            <textarea className="form-control" rows={2} value={comentario}
              onChange={(e) => setComentario(e.target.value)} placeholder="Opcional" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
      <Scanner
        open={scannerOpen}
        mode="lote"
        onClose={() => setScannerOpen(false)}
        onLoteItem={(assetNumber) => {
          setAsset(applyAssetMask(normalizeAssetNumber(assetNumber)))
          setScannerOpen(false)
          return true
        }}
        onConcluirLote={() => setScannerOpen(false)}
      />
    </div>
  )
}
