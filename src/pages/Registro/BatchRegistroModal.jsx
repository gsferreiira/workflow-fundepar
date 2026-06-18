import { useEffect, useState, useMemo } from "react"
import { X, Loader2, ScanLine } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { useAudit } from "../../hooks/useAudit.js"
import { Scanner } from "../../components/Scanner.jsx"
import { normalizeAssetNumber } from "../../utils/format.js"
import { STATUS_OPTIONS } from "../Registro.shared.jsx"

export function BatchRegistroModal({ roomsFetcher, equipmentFetcher, invalidate, onClose, onSaved }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [busy, setBusy] = useState(false)
  const [assetsText, setAssetsText] = useState('')
  const [eqId, setEqId] = useState('')
  const [eqName, setEqName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [status, setStatus] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  useEffect(() => {
    Promise.all([roomsFetcher(), equipmentFetcher()])
      .then(([rm, eq]) => {
        setRooms(rm || [])
        setEquipment(eq || [])
      })
      .catch((err) => console.error('Registro: erro ao carregar salas/equipamentos', err))
  }, [roomsFetcher, equipmentFetcher])

  const assets = useMemo(
    () => [...new Set(assetsText.split(/[\n,;]+/).map(normalizeAssetNumber).filter(Boolean))],
    [assetsText],
  )

  const submit = async (e) => {
    e.preventDefault()
    if (assets.length === 0) { showToast('Informe ao menos um patrimônio.', 'warning'); return }
    if (!eqId) { showToast('Selecione o equipamento.', 'warning'); return }
    if (!roomId) { showToast('Selecione a localização atual.', 'warning'); return }

    setBusy(true)
    const { data: existing, error: existingError } = await supabase
      .from('equipment_locations')
      .select('asset_number')
      .in('asset_number', assets)
    if (existingError) {
      showToast('Erro ao validar patrimônios: ' + existingError.message, 'danger')
      setBusy(false)
      return
    }

    const existingSet = new Set((existing || []).map((item) => item.asset_number))
    const newAssets = assets.filter((asset) => !existingSet.has(asset))
    if (newAssets.length === 0) {
      showToast('Todos os patrimônios informados já estão registrados.', 'warning')
      setBusy(false)
      return
    }

    const movedAt = new Date().toISOString()
    const payload = newAssets.map((assetNumber) => ({
      equipment_id: eqId,
      asset_number: assetNumber,
      serial_number: null,
      received_by: receivedBy || null,
      current_room_id: roomId,
      moved_at: movedAt,
    }))

    const { error } = await supabase
      .from('equipment_locations')
      .insert(payload)
    if (error) {
      showToast('Erro ao registrar lote: ' + error.message, 'danger')
      setBusy(false)
      return
    }

    if (status) {
      const { error: statusError } = await supabase.from('equipment').update({ status }).eq('id', eqId)
      if (statusError) {
        showToast('Lote registrado, mas houve erro ao atualizar o status: ' + statusError.message, 'warning')
        setBusy(false)
        return
      }
      invalidate('equipment')
    }

    audit.log('batch_register', 'equipment_locations', null, {
      count: newAssets.length,
      skipped_existing: assets.length - newAssets.length,
      asset_numbers: newAssets,
    })
    showToast(`${newAssets.length} registro${newAssets.length !== 1 ? 's' : ''} criado${newAssets.length !== 1 ? 's' : ''}.`, 'success')
    setBusy(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h3>Registrar por lote</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Informe um patrimônio por linha. Patrimônios já registrados serão pulados.
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Patrimônios <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <textarea
              className="form-control"
              rows={5}
              value={assetsText}
              onChange={(e) => setAssetsText(e.target.value)}
              placeholder={'000.000.000.000\n000.000.000.001'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <small style={{ color: 'var(--text-secondary)' }}>
                {assets.length} patrimônio{assets.length !== 1 ? 's' : ''} identificado{assets.length !== 1 ? 's' : ''}.
              </small>
              <button type="button" className="btn-scanner compact" onClick={() => setScannerOpen(true)}>
                <ScanLine size={13} /> Scanner
              </button>
            </div>
          </div>
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
              <label>Status do item</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Não alterar</option>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Com quem está</label>
            <input type="text" className="form-control" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : `Registrar ${assets.length || ''}`}
            </button>
          </div>
        </form>
      </div>
      <Scanner
        open={scannerOpen}
        mode="lote"
        onClose={() => setScannerOpen(false)}
        onLoteItem={(assetNumber) => {
          const normalized = normalizeAssetNumber(assetNumber)
          if (assets.includes(normalized)) return false
          setAssetsText((prev) => `${prev}${prev.trim() ? '\n' : ''}${normalized}`)
          return true
        }}
        onConcluirLote={() => setScannerOpen(false)}
        loteCount={assets.length}
      />
    </div>
  )
}
