import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { X, FileSpreadsheet, History, MapPin, ArrowRightLeft, Check, UserMinus, Filter, ChevronDown, Plus, Loader2 } from 'lucide-react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Autocomplete } from '../components/Autocomplete.jsx'
import { applyAssetMask, formatAssetNumber, fmtDateTime } from '../utils/format.js'

const STATUS_MAP = {
  novo: { bg: 'rgba(16,185,129,.12)', color: '#059669' },
  bom: { bg: 'rgba(59,130,246,.12)', color: '#2563eb' },
  regular: { bg: 'rgba(245,158,11,.12)', color: '#d97706' },
  inservível: { bg: 'rgba(239,68,68,.12)', color: '#dc2626' },
  'com defeito': { bg: 'rgba(168,85,247,.12)', color: '#7e22ce' },
}

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'bom', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'inservível', label: 'Inservível' },
  { value: 'com defeito', label: 'Com Defeito' },
]

const normalizeAssetNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 12) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
  }
  return String(value || '').trim()
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  const c = STATUS_MAP[s] || { bg: 'rgba(0,0,0,.06)', color: 'var(--text-secondary)' }
  const label = STATUS_OPTIONS.find((option) => option.value === s)?.label
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status ? label || status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  )
}

export function Registro() {
  const { registerRefresh } = useOutletContext() || {}
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { rooms: roomsFetcher, equipment: equipmentFetcher, invalidate } = useStore()
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMovedFrom, setFilterMovedFrom] = useState('')
  const [filterMovedTo, setFilterMovedTo] = useState('')
  const [sort, setSort] = useState('az')
  const [historyEq, setHistoryEq] = useState(null)
  const [assetLookupOpen, setAssetLookupOpen] = useState(false)
  const [batchRegisterOpen, setBatchRegisterOpen] = useState(false)
  const [newRegistroAsset, setNewRegistroAsset] = useState(null)
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    registerRefresh?.(() => refetchRef.current?.())
    return () => registerRefresh?.(null)
  }, [registerRefresh])

  useEffect(() => {
    const assetNumber = location.state?.newRegistroAsset
    if (!assetNumber) return
    setNewRegistroAsset(normalizeAssetNumber(assetNumber))
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  // showToast não pertence às deps — é estável o suficiente e sua presença
  // causaria re-execuções desnecessárias do efeito caso o contexto recrie a função.
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

  useEffect(() => {
    const load = async () => {
      const [
        { data: locations, error },
        { data: rooms },
      ] = await Promise.all([
        supabase
          .from('equipment_locations')
          .select(
            'equipment_id, equipment(name,categoria,status,observacao), asset_number, serial_number, moved_at, current_room_id',
          )
          .order('moved_at', { ascending: false })
          .limit(5000),
        supabase.from('rooms').select('id, name').is('deleted_at', null),
      ])

      if (error) {
        showToastRef.current(error.message, 'danger')
        return
      }

      const roomMap = Object.fromEntries((rooms || []).map((r) => [r.id, r]))
      const assetNumbers = [...new Set((locations || []).map((m) => m.asset_number).filter(Boolean))]
      let receiverByAsset = {}
      if (assetNumbers.length > 0) {
        const { data: latestMovements, error: movementsError } = await supabase
          .from('asset_movements')
          .select('asset_number, received_by, moved_at')
          .in('asset_number', assetNumbers)
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })

        if (movementsError) {
          console.warn('Registro — recebedor não carregado:', movementsError.message)
        } else {
          ;(latestMovements || []).forEach((movement) => {
            if (!receiverByAsset[movement.asset_number]) {
              receiverByAsset[movement.asset_number] = movement.received_by || null
            }
          })
        }
      }

      const items = []
      ;(locations || []).forEach((m) => {
        if (!m.current_room_id) return
        const key = m.asset_number
          ? `pat_${m.asset_number}`
          : m.serial_number
            ? `eq_${m.equipment_id}_ser_${m.serial_number}`
            : `eq_${m.equipment_id}`
        items.push({
          key,
          equipment_id: m.equipment_id,
          equipment: m.equipment,
          categoria: m.equipment?.categoria || null,
          status: m.equipment?.status || null,
          observacao: m.equipment?.observacao || null,
          asset_number: m.asset_number || null,
          serial_number: m.serial_number || null,
          received_by: receiverByAsset[m.asset_number] || null,
          moved_at: m.moved_at || null,
          destination_room_id: m.current_room_id,
          current_room_id: m.current_room_id,
          moved_by: null,
          room: roomMap[m.current_room_id] || null,
          profile: null,
        })
      })

      setData(items)
    }
    load()
  }, [reloadToken])

  const uniqueRooms = useMemo(() => {
    if (!data) return []
    return Object.values(
      Object.fromEntries(
        data.filter((d) => d.room).map((d) => [d.destination_room_id, d.room]),
      ),
    ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [data])

  const categorias = useMemo(() => {
    if (!data) return []
    return [...new Set(data.filter((d) => d.categoria).map((d) => d.categoria))].sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = (search || '').toLowerCase().trim()
    const fromTs = filterMovedFrom ? new Date(filterMovedFrom).toISOString() : null
    const toTs = filterMovedTo ? new Date(filterMovedTo).toISOString() : null

    let result = data.filter((d) => {
      if (filterRoom && d.destination_room_id !== filterRoom) return false
      if (filterCat && (d.categoria || '') !== filterCat) return false
      if (filterStatus && (d.status || '') !== filterStatus) return false
      if (fromTs && (d.moved_at || '') < fromTs) return false
      if (toTs && (d.moved_at || '') > toTs) return false
      if (q) {
        const hay = [
          d.equipment?.name || '',
          d.asset_number || '',
          d.serial_number || '',
          d.categoria || '',
          d.received_by || '',
          d.observacao || '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    if (sort === 'az')
      result.sort((a, b) =>
        (a.equipment?.name || '').localeCompare(b.equipment?.name || '', 'pt-BR'),
      )
    else if (sort === 'za')
      result.sort((a, b) =>
        (b.equipment?.name || '').localeCompare(a.equipment?.name || '', 'pt-BR'),
      )
    else if (sort === 'pat')
      result.sort((a, b) =>
        (a.asset_number || 'zzz').localeCompare(b.asset_number || 'zzz', 'pt-BR', {
          numeric: true,
        }),
      )
    else if (sort === 'sala')
      result.sort((a, b) =>
        (a.room?.name || 'zzz').localeCompare(b.room?.name || 'zzz', 'pt-BR'),
      )
    else if (sort === 'cat')
      result.sort((a, b) =>
        (a.categoria || 'zzz').localeCompare(b.categoria || 'zzz', 'pt-BR'),
      )
    else if (sort === 'data_desc')
      result.sort((a, b) => (b.moved_at || '').localeCompare(a.moved_at || ''))
    else if (sort === 'data_asc')
      result.sort((a, b) => (a.moved_at || '').localeCompare(b.moved_at || ''))

    return result
  }, [data, search, filterRoom, filterCat, filterStatus, filterMovedFrom, filterMovedTo, sort])

  const exportExcel = async () => {
    try {
      if (filtered.length === 0) {
        showToast('Nenhum equipamento para exportar.', 'warning')
        return
      }
      const xlsxMod = await import('xlsx')
      const XLSX = xlsxMod.default && xlsxMod.default.utils ? xlsxMod.default : xlsxMod
      if (!XLSX?.utils?.book_new) {
        showToast('Biblioteca de exportação não carregada.', 'danger')
        return
      }
      const wsData = [
      ['Equipamento', 'Categoria', 'Status', 'Nº Patrimônio', 'Nº Série', 'Localização Atual', 'Com quem está', 'Último Registro', 'Observação'],
      ...filtered.map((d) => [
        d.equipment?.name || '—',
        d.categoria || '—',
        d.status || '—',
        formatAssetNumber(d.asset_number) || '—',
        d.serial_number || '—',
        d.room?.name || 'Não localizado',
        d.received_by || '—',
        d.moved_at ? new Date(d.moved_at).toLocaleString('pt-BR') : 'Nunca registrado',
        d.observacao || '—',
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [
      { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
      { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 30 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Registro')
    XLSX.writeFile(wb, `registro_${new Date().toISOString().slice(0, 10)}.xlsx`)
    showToast('Arquivo exportado!', 'success')
    } catch (err) {
      console.error('exportExcel erro:', err)
      showToast('Erro ao exportar: ' + (err?.message || 'falha inesperada'), 'danger')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setFilterRoom('')
    setFilterCat('')
    setFilterStatus('')
    setFilterMovedFrom('')
    setFilterMovedTo('')
    setSort('az')
  }

  const hasFilters = search || filterRoom || filterCat || filterStatus || filterMovedFrom || filterMovedTo || sort !== 'az'

  const filterCount = [search, filterRoom, filterCat, filterStatus, filterMovedFrom, filterMovedTo].filter(Boolean).length + (sort !== 'az' ? 1 : 0)

  // ── Seleção múltipla / Bulk move ──────────────────────────────────
  const toggleSelected = useCallback((key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selectedKeys.has(d.key))

  const toggleAllFiltered = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filtered.forEach((d) => next.delete(d.key))
      } else {
        filtered.forEach((d) => next.add(d.key))
      }
      return next
    })
  }, [filtered, allFilteredSelected])

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), [])

  const selectedItems = useMemo(
    () => filtered.filter((d) => selectedKeys.has(d.key)),
    [filtered, selectedKeys],
  )

  const exportSelected = async () => {
    try {
      if (selectedItems.length === 0) return
      const xlsxMod = await import('xlsx')
      const XLSX = xlsxMod.default && xlsxMod.default.utils ? xlsxMod.default : xlsxMod
      if (!XLSX?.utils?.book_new) { showToast('Biblioteca de exportação não carregada.', 'danger'); return }
      const wsData = [
        ['Equipamento', 'Categoria', 'Status', 'Nº Patrimônio', 'Nº Série', 'Localização Atual', 'Com quem está', 'Último Registro', 'Observação'],
        ...selectedItems.map((d) => [
          d.equipment?.name || '—',
          d.categoria || '—',
          d.status || '—',
          formatAssetNumber(d.asset_number) || '—',
          d.serial_number || '—',
          d.room?.name || 'Não localizado',
          d.received_by || '—',
          d.moved_at ? new Date(d.moved_at).toLocaleString('pt-BR') : 'Nunca registrado',
          d.observacao || '—',
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 30 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Selecionados')
      XLSX.writeFile(wb, `registro_selecionados_${new Date().toISOString().slice(0, 10)}.xlsx`)
      showToast(`${selectedItems.length} item${selectedItems.length !== 1 ? 's exportados' : ' exportado'}!`, 'success')
    } catch (err) {
      showToast('Erro ao exportar: ' + (err?.message || 'falha inesperada'), 'danger')
    }
  }

  if (!data) return <SkeletonTable />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Registro de Patrimônio</h2>
          <p>Localização atual de cada equipamento individual no sistema.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => setAssetLookupOpen(true)}
          >
            <Plus size={14} /> Registrar equipamento
          </button>
          <button
            className="btn-primary"
            onClick={() => setBatchRegisterOpen(true)}
          >
            <Plus size={14} /> Registrar por lote
          </button>
          <button
            className="btn-primary"
            style={{ background: '#059669' }}
            onClick={exportExcel}
            disabled={!filtered || filtered.length === 0}
            title={filtered?.length === 0 ? 'Sem itens para exportar' : 'Exportar todos os itens filtrados'}
          >
            <FileSpreadsheet size={14} /> Exportar Excel
            {filtered && filtered.length > 0 && ` (${filtered.length})`}
          </button>
        </div>
      </div>

      <div className={`filter-bar fade-in${filtersOpen ? ' filters-open' : ''}`}>
        <button
          type="button"
          className={`mobile-filter-btn${filterCount > 0 ? ' has-filters' : ''}`}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Filter size={15} />
          <span className="mobile-filter-btn-label">
            Filtros{filterCount > 0 ? ` (${filterCount} ativo${filterCount !== 1 ? 's' : ''})` : ''}
          </span>
          <ChevronDown size={14} className="filter-chevron" />
        </button>
        <div className="filter-collapsible">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 2, minWidth: 180 }}>
            <label className="filter-label">Pesquisar</label>
            <input
              type="text"
              className="form-control filter-control"
              placeholder="Nome, patrimônio, série..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Sala</label>
            <select
              className="form-control filter-control"
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
            >
              <option value="">Todas</option>
              {uniqueRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Categoria</label>
            <select
              className="form-control filter-control"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              className="form-control filter-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Ordenar por</label>
            <select
              className="form-control filter-control"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="az">Nome (A–Z)</option>
              <option value="za">Nome (Z–A)</option>
              <option value="pat">Nº Patrimônio</option>
              <option value="sala">Sala</option>
              <option value="cat">Categoria</option>
              <option value="data_desc">Mais recentes primeiro</option>
              <option value="data_asc">Mais antigos primeiro</option>
            </select>
          </div>
        </div>

        <div className="filter-row" style={{ marginTop: 8 }}>
          <div className="filter-group" style={{ flex: 1 }}>
            <label className="filter-label">Último registro a partir de</label>
            <input
              type="datetime-local"
              className="form-control filter-control"
              value={filterMovedFrom}
              onChange={(e) => setFilterMovedFrom(e.target.value)}
            />
          </div>
          <div className="filter-group" style={{ flex: 1 }}>
            <label className="filter-label">Último registro até</label>
            <input
              type="datetime-local"
              className="form-control filter-control"
              value={filterMovedTo}
              onChange={(e) => setFilterMovedTo(e.target.value)}
            />
          </div>
          <div className="filter-group" style={{ flex: 2 }} />
        </div>
        </div>

        <div className="filter-actions">
          <span className="filter-count">
            {filtered.length} equipamento{filtered.length !== 1 ? 's' : ''}
            {data && filtered.length !== data.length ? ` de ${data.length}` : ''}
          </span>
          <button className="btn-filter-clear" onClick={clearFilters} disabled={!hasFilters}>
            <X size={13} /> Limpar filtros
          </button>
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className="bulk-action-bar fade-in">
          <div className="bulk-action-info">
            <Check size={16} />
            <strong>{selectedItems.length}</strong> selecionado{selectedItems.length !== 1 ? 's' : ''}
          </div>
          <div className="bulk-action-buttons">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setBulkModalOpen(true)}
            >
              <ArrowRightLeft size={14} /><span className="btn-text"> Atualizar registro de {selectedItems.length}</span>
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#059669' }}
              onClick={exportSelected}
            >
              <FileSpreadsheet size={14} /><span className="btn-text"> Exportar Excel</span>
            </button>
            <button
              type="button"
              className="btn-filter-clear"
              onClick={clearSelection}
            >
              <X size={13} /><span className="btn-text"> Limpar seleção</span>
            </button>
          </div>
        </div>
      )}

      <div className="table-card fade-in table-card-view">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  className="bulk-checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  aria-label="Selecionar todos os equipamentos filtrados"
                />
              </th>
              <th>Equipamento</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Nº Patrimônio</th>
              <th>Localização Atual</th>
              <th>Com quem está</th>
              <th>Último Registro</th>
              <th style={{ width: 80 }}>Histórico</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    preset={search || filterRoom || filterCat || filterStatus || filterMovedFrom || filterMovedTo ? 'search' : 'package'}
                    title={search || filterRoom || filterCat || filterStatus || filterMovedFrom || filterMovedTo ? 'Nenhum patrimônio encontrado' : 'Nenhum patrimônio registrado'}
                    description={search || filterRoom || filterCat || filterStatus || filterMovedFrom || filterMovedTo ? 'Tente ajustar os filtros.' : 'Registre patrimônios para acompanhar equipamentos.'}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr
                  key={d.key}
                  className={selectedKeys.has(d.key) ? 'row-selected' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return
                    toggleSelected(d.key)
                  }}
                >
                  <td className="card-checkbox-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={selectedKeys.has(d.key)}
                      onChange={() => toggleSelected(d.key)}
                      aria-label={`Selecionar ${d.equipment?.name || d.key}`}
                    />
                  </td>
                  <td data-label="Equipamento">
                    <strong>{d.equipment?.name || '—'}</strong>
                    {d.serial_number && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Série: {d.serial_number}
                      </div>
                    )}
                  </td>
                  <td data-label="Categoria">
                    {d.categoria ? (
                      <span
                        style={{
                          background: 'rgba(99,102,241,.1)',
                          color: '#6366f1',
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {d.categoria}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={d.status} />
                  </td>
                  <td data-label="Patrimônio" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {formatAssetNumber(d.asset_number) || '—'}
                  </td>
                  <td data-label="Localização">
                    {d.room ? (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--accent-color)',
                        }}
                      >
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        {d.room.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Não localizado</span>
                    )}
                  </td>
                  <td data-label="Com quem está" style={{ color: 'var(--text-secondary)' }}>{d.received_by || '—'}</td>
                  <td data-label="Registrado em" style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {d.moved_at ? fmtDateTime(d.moved_at) : '—'}
                  </td>
                  <td className="card-actions-cell">
                    <button
                      className="btn-table-action edit"
                      onClick={(e) => { e.stopPropagation(); setHistoryEq(d) }}
                      title="Ver histórico"
                    >
                      <History size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {historyEq && (
        <HistoryModal item={historyEq} onClose={() => setHistoryEq(null)} />
      )}

      {bulkModalOpen && (
        <BulkMoveModal
          items={selectedItems}
          onClose={() => setBulkModalOpen(false)}
          onSuccess={() => {
            setBulkModalOpen(false)
            clearSelection()
            refetch()
          }}
        />
      )}

      {assetLookupOpen && (
        <AssetLookupModal
          onClose={() => setAssetLookupOpen(false)}
          onNew={(assetNumber) => {
            setAssetLookupOpen(false)
            setNewRegistroAsset(assetNumber)
          }}
        />
      )}

      {newRegistroAsset && (
        <NewRegistroModal
          assetNumber={newRegistroAsset}
          roomsFetcher={roomsFetcher}
          equipmentFetcher={equipmentFetcher}
          invalidate={invalidate}
          onClose={() => setNewRegistroAsset(null)}
          onSaved={() => {
            setNewRegistroAsset(null)
            refetch()
          }}
        />
      )}

      {batchRegisterOpen && (
        <BatchRegistroModal
          roomsFetcher={roomsFetcher}
          equipmentFetcher={equipmentFetcher}
          invalidate={invalidate}
          onClose={() => setBatchRegisterOpen(false)}
          onSaved={() => {
            setBatchRegisterOpen(false)
            refetch()
          }}
        />
      )}
    </>
  )
}

function AssetLookupModal({ onClose, onNew }) {
  const { showToast } = useToast()
  const [asset, setAsset] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const assetNumber = normalizeAssetNumber(asset)
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
            <input
              type="text"
              className="form-control"
              value={asset}
              onChange={(e) => setAsset(applyAssetMask(e.target.value))}
              placeholder="000.000.000.000"
              autoFocus
            />
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
    </div>
  )
}

function NewRegistroModal({ assetNumber, roomsFetcher, equipmentFetcher, invalidate, onClose, onSaved }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [busy, setBusy] = useState(false)
  const [eqId, setEqId] = useState('')
  const [eqName, setEqName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [serial, setSerial] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([roomsFetcher(), equipmentFetcher()]).then(([rm, eq]) => {
      setRooms(rm || [])
      setEquipment(eq || [])
    })
  }, [roomsFetcher, equipmentFetcher])

  const submit = async (e) => {
    e.preventDefault()
    if (!eqId) { showToast('Selecione o equipamento.', 'warning'); return }
    if (!roomId) { showToast('Selecione a localização atual.', 'warning'); return }

    setBusy(true)
    const movedAt = new Date().toISOString()
    const { error } = await supabase
      .from('equipment_locations')
      .upsert({
        equipment_id: eqId,
        asset_number: assetNumber,
        serial_number: serial || null,
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
    onSaved()
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
            <Autocomplete
              items={equipment}
              value={eqId}
              label={eqName}
              onChange={(id, name) => { setEqId(id); setEqName(name || '') }}
              placeholder="Selecione o equipamento..."
              required
            />
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

function BatchRegistroModal({ roomsFetcher, equipmentFetcher, invalidate, onClose, onSaved }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [busy, setBusy] = useState(false)
  const [assetsText, setAssetsText] = useState('')
  const [eqId, setEqId] = useState('')
  const [eqName, setEqName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([roomsFetcher(), equipmentFetcher()]).then(([rm, eq]) => {
      setRooms(rm || [])
      setEquipment(eq || [])
    })
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
            <small style={{ color: 'var(--text-secondary)' }}>
              {assets.length} patrimônio{assets.length !== 1 ? 's' : ''} identificado{assets.length !== 1 ? 's' : ''}.
            </small>
          </div>
          <div className="form-group">
            <label>Equipamento <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <Autocomplete
              items={equipment}
              value={eqId}
              label={eqName}
              onChange={(id, name) => { setEqId(id); setEqName(name || '') }}
              placeholder="Selecione o equipamento..."
              required
            />
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
    </div>
  )
}

function BulkMoveModal({ items, onClose, onSuccess }) {
  const { rooms: roomsFetcher } = useStore()
  const { showToast } = useToast()
  const audit = useAudit()
  const [rooms, setRooms] = useState([])
  const [destRoomId, setDestRoomId] = useState('')
  // receivedBy: texto para sobrescrever todos; clearReceiver: remove o recebedor de todos
  const [receivedBy, setReceivedBy] = useState('')
  const [clearReceiver, setClearReceiver] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    roomsFetcher().then(setRooms)
  }, [roomsFetcher])

  const skippable = useMemo(
    () => items.filter((i) => destRoomId && i.destination_room_id === destRoomId),
    [items, destRoomId],
  )
  const toMove = items.length - skippable.length

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
    if (!destRoomId) {
      showToast('Selecione a sala de destino.', 'warning')
      return
    }
    if (toMove === 0) {
      showToast('Todos os selecionados já estão nessa sala.', 'warning')
      return
    }
    setSubmitting(true)
    const movedAt = new Date().toISOString()
    const destRoom = rooms.find((r) => r.id === destRoomId)

    const records = items
      .filter((i) => i.destination_room_id !== destRoomId)
      .map((i) => ({
        equipment_id: i.equipment_id,
        serial_number: i.serial_number,
        asset_number: i.asset_number,
        current_room_id: destRoomId,
        moved_at: movedAt,
      }))

    for (const record of records) {
      const payload = {
        equipment_id: record.equipment_id,
        asset_number: record.asset_number,
        serial_number: record.serial_number,
        current_room_id: record.current_room_id,
        moved_at: record.moved_at,
      }
      const { error } = await supabase
        .from('equipment_locations')
        .upsert(payload, { onConflict: 'asset_number' })
      if (error) {
        showToast('Erro ao atualizar registro: ' + error.message, 'danger')
        setSubmitting(false)
        return
      }
    }

    audit.log('bulk_register_update', 'equipment_locations', null, {
      count: records.length,
      destination: destRoom?.name,
      asset_numbers: records.map((m) => m.asset_number).filter(Boolean),
    })

    showToast(
      `${records.length} ${records.length === 1 ? 'registro atualizado' : 'registros atualizados'} para "${destRoom?.name}".`,
      'success',
    )
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
            <label>
              Localização atual <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <select
              className="form-control"
              required
              value={destRoomId}
              onChange={(e) => setDestRoomId(e.target.value)}
            >
              <option value="">Selecione...</option>
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
            <button type="submit" className="btn-primary" disabled={submitting || toMove === 0}>
              {submitting ? 'Atualizando...' : `Atualizar ${toMove} ${toMove === 1 ? 'registro' : 'registros'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HistoryModal({ item, onClose }) {
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
