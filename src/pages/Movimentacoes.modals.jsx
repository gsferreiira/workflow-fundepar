import { useEffect, useState } from 'react'
import {
  Plus,
  X,
  Loader2,
  Pencil,
  Trash2,
  FileSpreadsheet,
  ChevronDown,
  Upload,
  ScanLine,
  MapPin,
  History,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Check,
  Filter,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { Pagination } from '../components/Pagination.jsx'
import { Scanner, ScanResultModal } from '../components/Scanner.jsx'
import {
  formatAssetNumber,
  normalizeAssetNumber,
  applyAssetMask,
  fmtDateTime,
  toDateTimeLocalValue,
  dateTimeLocalValueToIso,
} from '../utils/format.js'
import { EQUIPMENT_STATUS_OPTIONS, ReceiverSelect } from "./Movimentacoes.shared.jsx"

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

export function LoteModal({
  equipment, rooms, profilesList, loteItems, setLoteItems, loteUid, setLoteUid,
  destId, setDestId, destName, setDestName,
  receivedBy, setReceivedBy, receivedByProfileId, setReceivedByProfileId,
  itemStatus, setItemStatus,
  comentario, setComentario, busy, onScan, onSubmit, onClose,
}) {
  const addItem = () => {
    const uid = loteUid + 1
    setLoteUid(uid)
    setLoteItems((prev) => [...prev, { uid, assetNumber: '', equipmentId: '', equipmentName: '', serialNumber: '' }])
  }

  const removeItem = (uid) => {
    setLoteItems((prev) => prev.filter((i) => i.uid !== uid))
  }

  const updateItem = (uid, field, value) => {
    setLoteItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, [field]: value } : i)))
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h3>Movimentação em Lote</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {loteItems.length} item{loteItems.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit}>
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
              <label>Status dos itens</label>
              <select className="form-control" value={itemStatus} onChange={(e) => setItemStatus(e.target.value)}>
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

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Patrimônios</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-primary" style={{ background: 'var(--warning-color)', padding: '5px 12px', fontSize: 12 }} onClick={onScan}>
                  <ScanLine size={13} /> Scanner
                </button>
                <button type="button" className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={addItem}>
                  <Plus size={13} /> Adicionar
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
              {loteItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Use o botão "Adicionar" ou o scanner para incluir patrimônios.
                </div>
              ) : (
                loteItems.map((item) => (
                  <div key={item.uid} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 2, minWidth: 0 }}>
                      <input type="text" className="form-control" value={item.assetNumber}
                        onChange={(e) => updateItem(item.uid, 'assetNumber', applyAssetMask(e.target.value))}
                        placeholder="Nº Patrimônio *" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input type="text" className="form-control" value={item.serialNumber}
                        onChange={(e) => updateItem(item.uid, 'serialNumber', e.target.value)}
                        placeholder="Nº Série" />
                    </div>
                    <button type="button" onClick={() => removeItem(item.uid)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '8px 4px', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy || loteItems.length === 0}>
              {busy ? <Loader2 size={14} className="spin" /> : `Registrar ${loteItems.length} movimentaç${loteItems.length !== 1 ? 'ões' : 'ão'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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

export function EditInfoModal({ movId, onClose }) {
  const { showToast } = useToast()
  const [logs, setLogs] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: editLogs, error }, { data: profilesList }] = await Promise.all([
        supabase
          .from('movement_edits')
          .select('*')
          .eq('movement_id', movId)
          .order('edited_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name'),
      ])
      if (error) {
        showToast('Erro ao carregar histórico.', 'danger')
        return
      }
      const profileMap = Object.fromEntries((profilesList || []).map((p) => [p.id, p]))
      setLogs(
        (editLogs || []).map((log) => ({
          ...log,
          editor_name: profileMap[log.edited_by]?.full_name || '—',
        })),
      )
    }
    load()
  }, [movId])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>Histórico de Edições</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        {!logs ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma edição registrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {logs.map((log) => (
              <div key={log.id} style={{ background: 'var(--bg-main)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{log.editor_name}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtDateTime(log.edited_at)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {log.edit_reason}
                </p>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

export function ImportPreviewModal({ rows, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const validCount = rows.filter((r) => r.status !== 'error').length
  const errorCount = rows.filter((r) => r.status === 'error').length

  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div>
            <h3>Prévia da Importação</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {validCount} válida{validCount !== 1 ? 's' : ''} · {errorCount} com erro
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="data-table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Equipamento</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Nº Patrimônio</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    {row.status === 'ok' && <CheckCircle2 size={15} style={{ color: '#059669' }} />}
                    {row.status === 'warn' && (
                      <div title={row.warnings.join('; ')}>
                        <AlertTriangle size={15} style={{ color: '#d97706' }} />
                      </div>
                    )}
                    {row.status === 'error' && (
                      <div title={row.errors.join('; ')}>
                        <AlertCircle size={15} style={{ color: '#dc2626' }} />
                      </div>
                    )}
                  </td>
                  <td style={{ color: row.status === 'error' ? '#dc2626' : undefined }}>
                    {row.equipmentName || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.originName || '—'}</td>
                  <td>{row.destName || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatAssetNumber(row.assetNumber) || '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {row.movedAtDisplay || '(agora)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={busy || validCount === 0}>
            {busy ? <Loader2 size={14} className="spin" /> : `Confirmar ${validCount} linha${validCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
