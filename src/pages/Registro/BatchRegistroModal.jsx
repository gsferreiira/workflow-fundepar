import { useEffect, useRef, useState } from "react"
import { X, Loader2, ScanLine, Plus, Trash2, CopyCheck } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { useAudit } from "../../hooks/useAudit.js"
import { Scanner } from "../../components/Scanner.jsx"
import { normalizeAssetNumber, formatAssetNumber } from "../../utils/format.js"
import { STATUS_OPTIONS } from "../Registro.shared.jsx"

const mkRow = (assetNumber, defaults) => ({
  assetNumber,
  eqId: defaults.eqId,
  roomId: defaults.roomId,
  receivedBy: defaults.receivedBy,
})

export function BatchRegistroModal({ roomsFetcher, equipmentFetcher, invalidate, onClose, onSaved }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [busy, setBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [manualAsset, setManualAsset] = useState('')

  // Defaults usados como template para novos itens + "aplicar a todos"
  const [defaults, setDefaults] = useState({ eqId: '', roomId: '', receivedBy: '', status: '' })
  const defaultsRef = useRef(defaults)
  defaultsRef.current = defaults

  // Tabela de itens (um por patrimônio)
  const [rows, setRows] = useState([])
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    Promise.all([roomsFetcher(), equipmentFetcher()])
      .then(([rm, eq]) => { setRooms(rm || []); setEquipment(eq || []) })
      .catch(() => {})
  }, [roomsFetcher, equipmentFetcher])

  const addAsset = (assetNumber) => {
    const normalized = normalizeAssetNumber(assetNumber)
    if (!normalized) return false
    if (rowsRef.current.some((r) => r.assetNumber === normalized)) return false
    setRows((prev) => [...prev, mkRow(normalized, defaultsRef.current)])
    return true
  }

  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx))

  const updateRow = (idx, field, value) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))

  const applyToAll = (field) => {
    const value = defaultsRef.current[field]
    setRows((prev) => prev.map((r) => ({ ...r, [field]: value })))
  }

  const addManual = () => {
    const normalized = normalizeAssetNumber(manualAsset)
    if (!normalized) { showToast('Número inválido.', 'warning'); return }
    if (rowsRef.current.some((r) => r.assetNumber === normalized)) {
      showToast('Patrimônio já adicionado.', 'warning'); return
    }
    setRows((prev) => [...prev, mkRow(normalized, defaultsRef.current)])
    setManualAsset('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (rows.length === 0) { showToast('Adicione ao menos um patrimônio.', 'warning'); return }
    const invalid = rows.filter((r) => !r.eqId || !r.roomId)
    if (invalid.length > 0) {
      showToast(`${invalid.length} item${invalid.length > 1 ? 'ns' : ''} sem equipamento ou sala definidos.`, 'warning')
      return
    }

    setBusy(true)
    const assetNumbers = rows.map((r) => r.assetNumber)
    const { data: existing, error: existingError } = await supabase
      .from('equipment_locations')
      .select('asset_number')
      .in('asset_number', assetNumbers)
    if (existingError) {
      showToast('Erro ao validar: ' + existingError.message, 'danger')
      setBusy(false)
      return
    }

    const existingSet = new Set((existing || []).map((i) => i.asset_number))
    const newRows = rows.filter((r) => !existingSet.has(r.assetNumber))
    if (newRows.length === 0) {
      showToast('Todos os patrimônios já estão registrados.', 'warning')
      setBusy(false)
      return
    }

    const movedAt = new Date().toISOString()
    const payload = newRows.map((r) => ({
      equipment_id: r.eqId,
      asset_number: r.assetNumber,
      serial_number: null,
      received_by: r.receivedBy || null,
      current_room_id: r.roomId,
      moved_at: movedAt,
    }))

    const { error } = await supabase.from('equipment_locations').insert(payload)
    if (error) {
      showToast('Erro ao registrar lote: ' + error.message, 'danger')
      setBusy(false)
      return
    }

    if (defaults.status) {
      const eqIds = [...new Set(newRows.map((r) => r.eqId))]
      await Promise.all(
        eqIds.map((id) => supabase.from('equipment').update({ status: defaults.status }).eq('id', id)),
      )
      invalidate('equipment')
    }

    audit.log('batch_register', 'equipment_locations', null, {
      count: newRows.length,
      skipped_existing: rows.length - newRows.length,
      asset_numbers: newRows.map((r) => r.assetNumber),
    })

    showToast(
      `${newRows.length} registro${newRows.length !== 1 ? 's' : ''} criado${newRows.length !== 1 ? 's' : ''}.`,
      'success',
    )
    setBusy(false)
    onSaved()
  }

  const invalidCount = rows.filter((r) => !r.eqId || !r.roomId).length

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 880 }}>
        <div className="modal-header">
          <div>
            <h3>Registrar por lote</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Escaneie ou adicione patrimônios. Use "Aplicar a todos" para preencher em massa.
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit}>
          {/* Seção de defaults — aplicar a todos */}
          <div style={{
            background: 'var(--bg-main)', borderRadius: 12, padding: '14px 16px',
            marginBottom: 16, border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>
              Preencher e aplicar a todos os itens
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Equipamento */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Equipamento</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="form-control"
                    style={{ flex: 1, fontSize: 13 }}
                    value={defaults.eqId}
                    onChange={(e) => setDefaults((d) => ({ ...d, eqId: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => applyToAll('eqId')}
                    disabled={!defaults.eqId || rows.length === 0}
                    style={applyBtnStyle(!defaults.eqId || rows.length === 0)}
                  >
                    <CopyCheck size={12} /> Aplicar a todos
                  </button>
                </div>
              </div>

              {/* Sala */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Sala / Setor</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="form-control"
                    style={{ flex: 1, fontSize: 13 }}
                    value={defaults.roomId}
                    onChange={(e) => setDefaults((d) => ({ ...d, roomId: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => applyToAll('roomId')}
                    disabled={!defaults.roomId || rows.length === 0}
                    style={applyBtnStyle(!defaults.roomId || rows.length === 0)}
                  >
                    <CopyCheck size={12} /> Aplicar a todos
                  </button>
                </div>
              </div>

              {/* Com quem */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Com quem está</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ flex: 1, fontSize: 13 }}
                    placeholder="Nome da pessoa (opcional)"
                    value={defaults.receivedBy}
                    onChange={(e) => setDefaults((d) => ({ ...d, receivedBy: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => applyToAll('receivedBy')}
                    disabled={rows.length === 0}
                    style={applyBtnStyle(rows.length === 0)}
                  >
                    <CopyCheck size={12} /> Aplicar a todos
                  </button>
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Status do item</label>
                <select
                  className="form-control"
                  style={{ fontSize: 13 }}
                  value={defaults.status}
                  onChange={(e) => setDefaults((d) => ({ ...d, status: e.target.value }))}
                >
                  <option value="">Não alterar</option>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Barra de adição manual + scanner */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Adicionar patrimônio manualmente
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: 000.000.000.001"
                value={manualAsset}
                onChange={(e) => setManualAsset(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
              />
            </div>
            <button type="button" className="btn-primary" style={{ height: 38, flexShrink: 0 }} onClick={addManual}>
              <Plus size={14} /> Adicionar
            </button>
            <button type="button" className="btn-scanner" style={{ height: 38, flexShrink: 0 }} onClick={() => setScannerOpen(true)}>
              <ScanLine size={13} /> Scanner
            </button>
          </div>

          {/* Tabela de itens */}
          {rows.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '28px 0', color: 'var(--text-secondary)',
              fontSize: 13, background: 'var(--bg-main)', borderRadius: 12,
              marginBottom: 16, border: '1px dashed var(--border-color)',
            }}>
              <ScanLine size={26} style={{ opacity: .2, display: 'block', margin: '0 auto 8px' }} />
              Nenhum patrimônio adicionado. Use o scanner ou adicione manualmente acima.
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 1 }}>
                    {['PAT', 'Equipamento', 'Sala / Setor', 'Com quem', ''].map((h) => (
                      <th key={h} style={{
                        padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                        color: 'var(--text-secondary)', textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border-color)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const rowInvalid = !row.eqId || !row.roomId
                    return (
                      <tr
                        key={row.assetNumber}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: rowInvalid ? 'rgba(239,68,68,.04)' : undefined,
                        }}
                      >
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatAssetNumber(row.assetNumber)}
                          {rowInvalid && (
                            <span style={{ color: '#ef4444', fontSize: 10, display: 'block', fontFamily: 'sans-serif', fontWeight: 400 }}>
                              obrigatórios
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '5px 6px' }}>
                          <select
                            className="form-control"
                            style={{ fontSize: 12, padding: '4px 6px' }}
                            value={row.eqId}
                            onChange={(e) => updateRow(idx, 'eqId', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '5px 6px' }}>
                          <select
                            className="form-control"
                            style={{ fontSize: 12, padding: '4px 6px' }}
                            value={row.roomId}
                            onChange={(e) => updateRow(idx, 'roomId', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '5px 6px' }}>
                          <input
                            type="text"
                            className="form-control"
                            style={{ fontSize: 12, padding: '4px 6px' }}
                            placeholder="Opcional"
                            value={row.receivedBy}
                            onChange={(e) => updateRow(idx, 'receivedBy', e.target.value)}
                          />
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            title="Remover"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, lineHeight: 0 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {rows.length} patrimônio{rows.length !== 1 ? 's' : ''}
              {invalidCount > 0 && (
                <span style={{ color: '#ef4444', marginLeft: 8 }}>
                  · {invalidCount} com campos obrigatórios faltando
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={busy || rows.length === 0}>
                {busy ? <Loader2 size={14} className="spin" /> : `Registrar ${rows.length || ''}`}
              </button>
            </div>
          </div>
        </form>
      </div>

      <Scanner
        open={scannerOpen}
        mode="lote"
        onClose={() => setScannerOpen(false)}
        onLoteItem={(assetNumber) => {
          const normalized = normalizeAssetNumber(assetNumber)
          if (!normalized) return false
          if (rowsRef.current.some((r) => r.assetNumber === normalized)) return false
          setRows((prev) => [...prev, mkRow(normalized, defaultsRef.current)])
          return true
        }}
        onConcluirLote={() => setScannerOpen(false)}
        loteCount={rows.length}
      />
    </div>
  )
}

const applyBtnStyle = (disabled) => ({
  padding: '5px 10px',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  opacity: disabled ? .4 : 1,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
})
