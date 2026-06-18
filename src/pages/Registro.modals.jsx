import { useCallback, useEffect, useState, useMemo } from "react"
import { X, FileSpreadsheet, History, MapPin, ArrowRightLeft, Check, UserMinus, Filter, ChevronDown, Plus, Loader2, ScanLine, Pencil, Trash2 } from "lucide-react"
import { supabase } from "../lib/supabase.js"
import { useStore } from "../contexts/StoreContext.jsx"
import { useToast } from "../contexts/ToastContext.jsx"
import { useAudit } from "../hooks/useAudit.js"
import { Scanner } from "../components/Scanner.jsx"
import { applyAssetMask, formatAssetNumber, fmtDateTime, normalizeAssetNumber } from "../utils/format.js"
import { STATUS_OPTIONS, isPrinterEquipment, StatusBadge } from "./Registro.shared.jsx"

export function AssetLookupModal({ onClose, onNew }) {
  const { showToast } = useToast()
  const [asset, setAsset] = useState('')
  const [busy, setBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const checkAsset = async (assetNumber) => {
    if (!assetNumber) {
      showToast('Informe o número de patrimônio.', 'warning')
      return
    }

    setBusy(true)
    const { data, error } = await supabase
      .from('equipment_locations')
      .select('asset_number')
      .eq('asset_number', assetNumber)
      .maybeSingle()
    setBusy(false)

    if (error) {
      showToast('Erro ao consultar patrimônio: ' + error.message, 'danger')
      return
    }
    if (data) {
      showToast(`PAT ${formatAssetNumber(assetNumber)} já possui registro.`, 'warning')
      onClose()
      return
    }
    onNew(assetNumber)
  }

  const submit = async (e) => {
    e.preventDefault()
    await checkAsset(normalizeAssetNumber(asset))
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div>
            <h3>Registrar equipamento</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Informe apenas o patrimônio para iniciar.
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nº Patrimônio <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-control"
                value={asset}
                onChange={(e) => setAsset(applyAssetMask(e.target.value))}
                placeholder="000.000.000.000"
                autoFocus
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-scanner" onClick={() => setScannerOpen(true)}>
                <ScanLine size={14} /> Scanner
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Continuar'}
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
          setScannerOpen(false)
          setAsset(applyAssetMask(normalized))
          checkAsset(normalized)
          return true
        }}
        onConcluirLote={() => setScannerOpen(false)}
      />
    </div>
  )
}

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

export function DeleteEquipmentModal({ item, onClose, onDeleted }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')

  const equipName = item.equipment?.name || '—'
  const assetLabel = item.asset_number ? formatAssetNumber(item.asset_number) : null
  const canDelete = typed.trim().toUpperCase() === 'EXCLUIR'

  const handleDelete = async () => {
    if (!canDelete) return
    setBusy(true)

    let q = supabase.from('equipment_locations').delete()
    if (item.asset_number) {
      q = q.eq('asset_number', item.asset_number)
    } else {
      q = q.eq('equipment_id', item.equipment_id)
      if (item.serial_number) q = q.eq('serial_number', item.serial_number)
      else q = q.is('serial_number', null)
    }

    const { error } = await q
    setBusy(false)
    if (error) { showToast('Erro ao excluir: ' + error.message, 'danger'); return }

    audit.log('delete', 'equipment_locations', item.asset_number || item.equipment_id, {
      equipment_name: equipName,
      asset_number: item.asset_number || null,
      serial_number: item.serial_number || null,
      room: item.room?.name || null,
    })

    showToast(`${equipName} excluído do registro.`, 'success')
    onDeleted()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3>Excluir equipamento</h3>
            <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>Ação irreversível</div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: '4px 0 16px' }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{equipName}</div>
            {assetLabel && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>PAT {assetLabel}</div>}
            {item.serial_number && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Série: {item.serial_number}</div>}
            {item.room && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{item.room.name}</div>}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.55 }}>
            O registro de localização deste patrimônio será removido permanentemente do sistema.
            O histórico de movimentações será mantido.
          </p>

          <div className="form-group">
            <label style={{ fontSize: 13 }}>Digite <strong>EXCLUIR</strong> para confirmar</label>
            <input
              type="text"
              className="form-control"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="EXCLUIR"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && canDelete) handleDelete() }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#e2e8f0', color: '#475569' }}
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#dc2626', opacity: canDelete ? 1 : .5 }}
            onClick={handleDelete}
            disabled={busy || !canDelete}
          >
            {busy ? <Loader2 size={14} className="spin" /> : 'Excluir permanentemente'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function HistoryModal({ item, onClose }) {
  const { showToast } = useToast()
  const [movements, setMovements] = useState(null)

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from('asset_movements')
        .select('id, asset_number, moved_at, received_by, origin_room_id, destination_room_id, moved_by')
        .is('deleted_at', null)
        .order('moved_at', { ascending: false })

      if (item.asset_number) {
        query = query.eq('asset_number', item.asset_number)
      } else if (item.serial_number && item.equipment_id) {
        query = query.eq('equipment_id', item.equipment_id).eq('serial_number', item.serial_number)
      } else if (item.equipment_id) {
        query = query.eq('equipment_id', item.equipment_id)
      }

      const { data: movs, error } = await query
      if (error) {
        showToast('Erro ao carregar histórico: ' + error.message, 'danger')
        return
      }
      if (!movs || movs.length === 0) { setMovements([]); return }

      const roomIds = [...new Set([
        ...movs.map(m => m.origin_room_id),
        ...movs.map(m => m.destination_room_id),
      ].filter(Boolean))]
      const profileIds = [...new Set(movs.map(m => m.moved_by).filter(Boolean))]

      const [{ data: rooms }, { data: profiles }] = await Promise.all([
        roomIds.length > 0
          ? supabase.from('rooms').select('id, name').in('id', roomIds)
          : Promise.resolve({ data: [] }),
        profileIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', profileIds)
          : Promise.resolve({ data: [] }),
      ])

      const roomMap = Object.fromEntries((rooms || []).map(r => [r.id, r]))
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

      setMovements(movs.map(m => ({
        ...m,
        origin_room:      roomMap[m.origin_room_id]      || null,
        destination_room: roomMap[m.destination_room_id] || null,
        profile:          profileMap[m.moved_by]         || null,
      })))
    }
    load()
  }, [item.asset_number, item.serial_number, item.equipment_id, showToast])

  const name = item.equipment?.name || '—'

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h3>Histórico de Movimentações</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{name}</div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {!movements ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Carregando...
          </div>
        ) : movements.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Nenhuma movimentação registrada.
          </div>
        ) : (
          <div style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
            {movements.map((m, i) => (
              <div key={m.id} className="mov-timeline-item">
                <div className="mov-timeline-left">
                  <div className="mov-timeline-dot" style={{ background: i === 0 ? 'var(--accent-color)' : 'var(--border-color)' }} />
                  {i < movements.length - 1 && <div className="mov-timeline-line" />}
                </div>
                <div className="mov-timeline-body">
                  <div className="mov-timeline-date">{fmtDateTime(m.moved_at)}</div>
                  <div className="mov-timeline-route">
                    <span className="mov-timeline-room origin">{m.origin_room?.name || 'Origem desconhecida'}</span>
                    <ArrowRightLeft size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                    <span className="mov-timeline-room dest">{m.destination_room?.name || '—'}</span>
                  </div>
                  {(m.profile?.full_name || m.received_by) && (
                    <div className="mov-timeline-meta">
                      {m.profile?.full_name && <span>Por: {m.profile.full_name}</span>}
                      {m.received_by && <span>Recebido por: {m.received_by}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            className="btn-primary"
            style={{ background: '#e2e8f0', color: '#475569' }}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
