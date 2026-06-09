import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, Pencil, Trash2, Loader2, Printer, FileSpreadsheet, Check } from 'lucide-react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Pagination } from '../components/Pagination.jsx'
import { fmtDateTime, formatAssetNumber, normalizeText } from '../utils/format.js'
import { exportXlsx } from '../utils/spreadsheet.js'

const PAGE_SIZE = 20
const STATUS_OPTIONS = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'inativa', label: 'Inativa' },
  { value: 'manutencao', label: 'Manutenção' },
]

function statusLabel(value) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label || value || '—'
}

function normalizePercent(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return Math.min(100, Math.max(0, parsed))
}

function PercentCell({ value }) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--text-secondary)' }}>—</span>
  }
  return <strong>{value}%</strong>
}

function roomLabel(room) {
  if (!room) return '—'
  return [room.room_number, room.name].filter(Boolean).join(' - ') || room.name || '—'
}

function isPrinterEquipment(equipment) {
  return normalizeText(equipment?.categoria).includes('impressora')
}

function equipmentModel(printer) {
  return printer?.equipment?.name || '—'
}

export function Impressoras() {
  const { search, registerRefresh } = useOutletContext()
  const location = useLocation()
  const navigate = useNavigate()
  const { rooms: roomsFetcher } = useStore()
  const { showToast, showUndoToast, confirm } = useToast()
  const audit = useAudit()
  const [printers, setPrinters] = useState(null)
  const [rooms, setRooms] = useState([])
  const [assetOptions, setAssetOptions] = useState([])
  const [createPrefill, setCreatePrefill] = useState(null)
  const [editPrinter, setEditPrinter] = useState(null)
  const [searchLocal, setSearchLocal] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const loadRef = useRef(null)

  const load = async () => {
    const [{ data, error }, roomList, { data: locations, error: locationsError }] = await Promise.all([
      supabase
        .from('printers')
        .select('*, room:room_id(id, name, room_number, sigla), equipment:equipment_id(id, name, categoria)')
        .is('deleted_at', null)
        .order('hostname'),
      roomsFetcher(),
      supabase
        .from('equipment_locations')
        .select('asset_number, equipment_id, current_room_id, equipment:equipment_id(id, name, categoria)')
        .not('asset_number', 'is', null)
        .order('asset_number'),
    ])
    if (error) {
      showToast('Erro ao carregar impressoras: ' + error.message, 'danger')
      return
    }
    if (locationsError) {
      showToast('Erro ao carregar patrimônios de impressoras: ' + locationsError.message, 'danger')
    }
    setPrinters(data || [])
    setRooms(roomList || [])
    setAssetOptions((locations || []).filter((item) => isPrinterEquipment(item.equipment)))
  }
  loadRef.current = load

  useEffect(() => {
    load()
    registerRefresh?.(() => loadRef.current?.())
    return () => registerRefresh?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const prefill = location.state?.printerAsset
    if (!prefill || !printers) return
    const existing = printers.find((printer) => printer.asset_number === prefill.assetNumber)
    if (existing) {
      setEditPrinter(existing)
    } else {
      setCreatePrefill(prefill)
    }
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate, printers])

  const filtered = useMemo(() => {
    if (!printers) return []
    const q = (search || searchLocal).toLowerCase().trim()
    return printers.filter((printer) => {
      if (statusFilter && printer.status !== statusFilter) return false
      if (roomFilter && printer.room_id !== roomFilter) return false
      if (!q) return true
      const hay = [
        printer.hostname,
        printer.ip_address,
        printer.status,
        printer.asset_number,
        printer.equipment?.name,
        printer.equipment?.categoria,
        printer.room?.name,
        printer.room?.room_number,
        printer.room?.sigla,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [printers, roomFilter, search, searchLocal, statusFilter])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  useEffect(() => {
    setPage(1)
  }, [roomFilter, search, searchLocal, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const onPrev = () => setPage((p) => Math.max(1, p - 1))
  const onNext = () => setPage((p) => Math.min(totalPages, p + 1))

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allPageSelected = pageItems.length > 0 && pageItems.every((printer) => selectedIds.has(printer.id))

  const toggleAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageItems.forEach((printer) => next.delete(printer.id))
      } else {
        pageItems.forEach((printer) => next.add(printer.id))
      }
      return next
    })
  }, [allPageSelected, pageItems])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const selectedPrinters = useMemo(
    () => filtered.filter((printer) => selectedIds.has(printer.id)),
    [filtered, selectedIds],
  )

  const exportExcel = async () => {
    const rows = selectedPrinters.length > 0 ? selectedPrinters : filtered
    if (rows.length === 0) return

    try {
      await exportXlsx({
        fileName: `impressoras_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheets: [{
          name: selectedPrinters.length > 0 ? 'Impressoras Selecionadas' : 'Impressoras',
          rows: [
            ['Hostname', 'Modelo do Equipamento', 'Patrimônio', 'Endereço IP', 'Sala Vinculada', 'Status', 'Toner', 'Unidade de Imagem', 'Kit de Manutenção', 'Data de Atualização'],
            ...rows.map((printer) => [
              printer.hostname || '—',
              equipmentModel(printer),
              formatAssetNumber(printer.asset_number) || '—',
              printer.ip_address || '—',
              roomLabel(printer.room),
              statusLabel(printer.status),
              printer.toner_percent == null ? '—' : `${printer.toner_percent}%`,
              printer.image_unit_percent == null ? '—' : `${printer.image_unit_percent}%`,
              printer.maintenance_kit_percent == null ? '—' : `${printer.maintenance_kit_percent}%`,
              printer.updated_at ? fmtDateTime(printer.updated_at) : fmtDateTime(printer.created_at),
            ]),
          ],
          columns: [24, 28, 18, 18, 32, 16, 12, 20, 20, 24],
        }],
      })
      showToast(`${rows.length} impressora${rows.length !== 1 ? 's exportadas' : ' exportada'}!`, 'success')
    } catch (error) {
      showToast('Erro ao exportar impressoras: ' + (error?.message || 'falha inesperada'), 'danger')
    }
  }

  const onDelete = async (id) => {
    const printer = printers.find((item) => item.id === id)
    const ok = await confirm({
      title: 'Excluir impressora',
      message: `Tem certeza que deseja excluir a impressora${printer ? ` "${printer.hostname}"` : ''}?`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return

    const { error } = await supabase
      .from('printers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) {
      showToast('Erro ao excluir impressora: ' + error.message, 'danger')
      return
    }

    audit.deleted('printers', id, { hostname: printer?.hostname })
    await load()
    showUndoToast(`Impressora "${printer?.hostname || 'sem hostname'}" excluída.`, async () => {
      await supabase.from('printers').update({ deleted_at: null }).eq('id', id)
      await load()
    })
  }

  if (!printers) return <SkeletonTable />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Impressoras</h2>
          <p>Cadastre e acompanhe os equipamentos de impressão da Fundepar.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreatePrefill({})}>
          <Plus size={14} /> Cadastrar Impressora
        </button>
      </div>

      <div className="filter-bar fade-in">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 2, minWidth: 180 }}>
            <label className="filter-label">Pesquisar</label>
            <input
              type="text"
              className="form-control filter-control"
              placeholder="Hostname, IP ou sala..."
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Sala</label>
            <select className="form-control filter-control" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">Todas</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{roomLabel(room)}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select className="form-control filter-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <span className="filter-count">
            {total} impressora{total !== 1 ? 's' : ''}
          </span>
          <button
            className="btn-filter-clear"
            onClick={() => {
              setSearchLocal('')
              setStatusFilter('')
              setRoomFilter('')
            }}
          >
            <X size={13} /> Limpar
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '6px 16px', fontSize: 13, background: '#059669' }}
            onClick={exportExcel}
            disabled={total === 0}
          >
            <FileSpreadsheet size={14} /> Exportar Excel
          </button>
        </div>
      </div>

      {selectedPrinters.length > 0 && (
        <div className="bulk-action-bar fade-in">
          <div className="bulk-action-info">
            <Check size={16} />
            <strong>{selectedPrinters.length}</strong> impressora{selectedPrinters.length !== 1 ? 's' : ''} selecionada{selectedPrinters.length !== 1 ? 's' : ''}
          </div>
          <div className="bulk-action-buttons">
            <button type="button" className="btn-primary" style={{ background: '#059669' }} onClick={exportExcel}>
              <FileSpreadsheet size={14} /><span className="btn-text"> Exportar selecionadas</span>
            </button>
            <button type="button" className="btn-filter-clear" onClick={clearSelection}>
              <X size={13} /><span className="btn-text"> Limpar seleção</span>
            </button>
          </div>
        </div>
      )}

      <div className="table-card fade-in">
        <table className="data-table" style={{ minWidth: 1280 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  className="bulk-checkbox"
                  checked={allPageSelected}
                  onChange={toggleAllPage}
                  aria-label="Selecionar todas as impressoras desta página"
                />
              </th>
              <th>Hostname</th>
              <th>Modelo do Equipamento</th>
              <th>Patrimônio</th>
              <th>Endereço IP</th>
              <th>Sala Vinculada</th>
              <th>Status</th>
              <th>Toner</th>
              <th>Unidade de Imagem</th>
              <th>Kit de Manutenção</th>
              <th>Data de Atualização</th>
              <th style={{ width: 130 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr>
                <td colSpan={12}>
                  <EmptyState
                    icon={Printer}
                    title={search || searchLocal || statusFilter || roomFilter ? 'Nenhuma impressora encontrada' : 'Nenhuma impressora cadastrada'}
                    description={search || searchLocal || statusFilter || roomFilter ? 'Tente ajustar a busca ou os filtros.' : 'Clique em "Cadastrar Impressora" para iniciar.'}
                  />
                </td>
              </tr>
            ) : (
              pageItems.map((printer) => (
                <tr
                  key={printer.id}
                  className={selectedIds.has(printer.id) ? 'row-selected' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('a')) return
                    toggleSelected(printer.id)
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={selectedIds.has(printer.id)}
                      onChange={() => toggleSelected(printer.id)}
                      aria-label={`Selecionar ${printer.hostname}`}
                    />
                  </td>
                  <td><strong>{printer.hostname}</strong></td>
                  <td>{equipmentModel(printer)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {formatAssetNumber(printer.asset_number) || '—'}
                  </td>
                  <td>
                    <a
                      href={`http://${printer.ip_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontWeight: 700 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {printer.ip_address}
                    </a>
                  </td>
                  <td>{roomLabel(printer.room)}</td>
                  <td>
                    <span className={`badge-status ${printer.status || 'ativa'}`}>
                      {statusLabel(printer.status)}
                    </span>
                  </td>
                  <td><PercentCell value={printer.toner_percent} /></td>
                  <td><PercentCell value={printer.image_unit_percent} /></td>
                  <td><PercentCell value={printer.maintenance_kit_percent} /></td>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {fmtDateTime(printer.updated_at || printer.created_at)}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-table-action edit" onClick={() => setEditPrinter(printer)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button className="btn-table-action delete" onClick={() => onDelete(printer.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPrev={onPrev} onNext={onNext} />

      {createPrefill !== null && (
        <PrinterModal
          rooms={rooms}
          assetOptions={assetOptions}
          prefill={createPrefill}
          onClose={() => setCreatePrefill(null)}
          onSaved={async () => {
            setCreatePrefill(null)
            await load()
          }}
        />
      )}
      {editPrinter && (
        <PrinterModal
          printer={editPrinter}
          rooms={rooms}
          assetOptions={assetOptions}
          onClose={() => setEditPrinter(null)}
          onSaved={async () => {
            setEditPrinter(null)
            await load()
          }}
        />
      )}
    </>
  )
}

function PrinterModal({ printer, rooms, assetOptions = [], prefill = {}, onClose, onSaved }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const audit = useAudit()
  const editing = !!printer
  const [busy, setBusy] = useState(false)
  const [assetNumber, setAssetNumber] = useState(printer?.asset_number || prefill?.assetNumber || '')
  const [equipmentId, setEquipmentId] = useState(printer?.equipment_id || prefill?.equipmentId || '')
  const [hostname, setHostname] = useState(printer?.hostname || '')
  const [ipAddress, setIpAddress] = useState(printer?.ip_address || '')
  const [roomId, setRoomId] = useState(printer?.room_id || prefill?.roomId || '')
  const [status, setStatus] = useState(printer?.status || 'ativa')
  const [toner, setToner] = useState(printer?.toner_percent ?? '')
  const [imageUnit, setImageUnit] = useState(printer?.image_unit_percent ?? '')
  const [maintenanceKit, setMaintenanceKit] = useState(printer?.maintenance_kit_percent ?? '')

  const availableAssets = useMemo(() => {
    if (!assetNumber || assetOptions.some((item) => item.asset_number === assetNumber)) {
      return assetOptions
    }
    return [
      {
        asset_number: assetNumber,
        equipment_id: equipmentId,
        current_room_id: roomId,
        equipment: {
          id: equipmentId,
          name: printer?.equipment?.name || prefill?.equipmentName || 'Equipamento vinculado',
          categoria: printer?.equipment?.categoria || 'Impressora',
        },
      },
      ...assetOptions,
    ]
  }, [assetNumber, assetOptions, equipmentId, prefill?.equipmentName, printer?.equipment, roomId])

  const selectedAsset = useMemo(
    () => availableAssets.find((item) => item.asset_number === assetNumber) || null,
    [assetNumber, availableAssets],
  )
  const selectedEquipmentName = selectedAsset?.equipment?.name || printer?.equipment?.name || prefill?.equipmentName || ''

  useEffect(() => {
    if (!selectedAsset) return
    setEquipmentId(selectedAsset.equipment_id || '')
    if (selectedAsset.current_room_id) setRoomId(selectedAsset.current_room_id)
  }, [selectedAsset])

  const submit = async (e) => {
    e.preventDefault()
    const finalEquipmentId = selectedAsset?.equipment_id || equipmentId
    const finalRoomId = roomId || selectedAsset?.current_room_id
    if (!assetNumber) {
      showToast('Selecione o patrimônio vinculado à impressora.', 'warning')
      return
    }
    if (!finalEquipmentId) {
      showToast('O patrimônio selecionado não possui equipamento vinculado.', 'warning')
      return
    }
    if (!finalRoomId) {
      showToast('Selecione a sala vinculada.', 'warning')
      return
    }
    const ipTrimmed = ipAddress.trim()
    const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipv4Re.test(ipTrimmed) || ipTrimmed.split('.').some((n) => Number(n) > 255)) {
      showToast('Endereço IP inválido. Use o formato 0.0.0.0 a 255.255.255.255.', 'warning')
      return
    }
    setBusy(true)

    const updates = {
      equipment_id: finalEquipmentId,
      asset_number: assetNumber,
      hostname: hostname.trim(),
      ip_address: ipAddress.trim(),
      room_id: finalRoomId,
      status,
      toner_percent: normalizePercent(toner),
      image_unit_percent: normalizePercent(imageUnit),
      maintenance_kit_percent: normalizePercent(maintenanceKit),
      updated_by: user?.id || null,
    }

    if (editing) {
      const { error } = await supabase.from('printers').update(updates).eq('id', printer.id)
      if (error) {
        showToast('Erro ao atualizar impressora: ' + error.message, 'danger')
        setBusy(false)
        return
      }
      audit.updated('printers', printer.id, {
        previous: {
          hostname: printer.hostname,
          equipment_id: printer.equipment_id,
          asset_number: printer.asset_number,
          ip_address: printer.ip_address,
          room_id: printer.room_id,
          status: printer.status,
          toner_percent: printer.toner_percent,
          image_unit_percent: printer.image_unit_percent,
          maintenance_kit_percent: printer.maintenance_kit_percent,
        },
        next: updates,
      })
      showToast('Impressora atualizada!', 'success')
      setBusy(false)
      onSaved()
      return
    }

    const { data: inserted, error } = await supabase
      .from('printers')
      .insert([{ ...updates, created_by: user?.id || null }])
      .select('id')
      .single()
    if (error) {
      showToast('Erro ao cadastrar impressora: ' + error.message, 'danger')
      setBusy(false)
      return
    }
    audit.created('printers', inserted?.id, {
      hostname: updates.hostname,
      ip_address: updates.ip_address,
      equipment_id: updates.equipment_id,
      asset_number: updates.asset_number,
    })
    showToast('Impressora cadastrada!', 'success')
    setBusy(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>{editing ? 'Editar Impressora' : 'Cadastrar Impressora'}</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-2col">
            <div className="form-group">
              <label>Patrimônio vinculado <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select
                className="form-control"
                required
                value={assetNumber}
                onChange={(e) => setAssetNumber(e.target.value)}
              >
                <option value="">Selecione...</option>
                {availableAssets.map((item) => (
                  <option key={item.asset_number} value={item.asset_number}>
                    {formatAssetNumber(item.asset_number)} - {item.equipment?.name || 'Equipamento sem nome'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Modelo do equipamento</label>
              <input
                type="text"
                className="form-control"
                value={selectedEquipmentName}
                readOnly
                placeholder="Selecione um patrimônio"
              />
            </div>
          </div>

          <div className="form-2col">
            <div className="form-group">
              <label>Hostname <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="Ex: IFUNDEPARXXXX"
              />
            </div>
            <div className="form-group">
              <label>Endereço IP <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="Ex: 10.45.0.XXX"
              />
            </div>
          </div>

          <div className="form-2col">
            <div className="form-group">
              <label>Sala vinculada <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select className="form-control" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Selecione...</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{roomLabel(room)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select className="form-control" required value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-2col">
            <div className="form-group">
              <label>Toner (%)</label>
              <input type="number" min="0" max="100" className="form-control" value={toner} onChange={(e) => setToner(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Unidade de Imagem (%)</label>
              <input type="number" min="0" max="100" className="form-control" value={imageUnit} onChange={(e) => setImageUnit(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Kit de Manutenção (%)</label>
            <input type="number" min="0" max="100" className="form-control" value={maintenanceKit} onChange={(e) => setMaintenanceKit(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : editing ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
