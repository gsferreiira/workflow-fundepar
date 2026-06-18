import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { X, FileSpreadsheet, History, MapPin, ArrowRightLeft, Check, UserMinus, Filter, ChevronDown, Plus, Loader2, ScanLine, Pencil, Trash2 } from 'lucide-react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Scanner } from '../components/Scanner.jsx'
import { Pagination } from '../components/Pagination.jsx'
import { formatAssetNumber, fmtDateTime, normalizeAssetNumber, debounce } from '../utils/format.js'
import { exportXlsx } from '../utils/spreadsheet.js'
import { DOMINIOS, ROLES_FULL_ACCESS, CATEGORIAS_POR_DOMINIO } from '../config/dominios.js'
import { PAGE_SIZE, STATUS_MAP, STATUS_OPTIONS, StatusBadge } from "./Registro.shared.jsx"
import {
  AssetLookupModal,
  NewRegistroModal,
  BatchRegistroModal,
  EditRegistroEquipmentModal,
  BulkMovementModal,
  BulkMoveModal,
  DeleteEquipmentModal,
  HistoryModal,
} from "./Registro.modals.jsx"

export function Registro() {
  const { registerRefresh } = useOutletContext() || {}
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { rooms: roomsFetcher, equipment: equipmentFetcher, invalidate } = useStore()
  const [data, setData] = useState(null)
  const [total, setTotal] = useState(0)
  const [roomOptions, setRoomOptions] = useState([])
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const debouncedSetSearch = useMemo(() => debounce((v) => setSearchDebounced(v), 300), [])
  useEffect(() => { debouncedSetSearch(search) }, [search, debouncedSetSearch])
  const canSeeAll = ROLES_FULL_ACCESS.includes(user?.role)
  const canEdit = user?.role !== 'usuario'
  const [filterRoom, setFilterRoom] = useState('')
  const [filterDominio, setFilterDominio] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMovedFrom, setFilterMovedFrom] = useState('')
  const [filterMovedTo, setFilterMovedTo] = useState('')
  const [sort, setSort] = useState('az')
  const [historyEq, setHistoryEq] = useState(null)
  const [editRegistroItem, setEditRegistroItem] = useState(null)
  const [assetLookupOpen, setAssetLookupOpen] = useState(false)
  const [batchRegisterOpen, setBatchRegisterOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState(null)
  const [newRegistroAsset, setNewRegistroAsset] = useState(null)
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkMovementModalOpen, setBulkMovementModalOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
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

  // Carrega opções de sala (para o filtro de sala) sem misturar com a query paginada
  useEffect(() => {
    supabase
      .from('rooms')
      .select('id, name')
      .is('deleted_at', null)
      .then(({ data: rooms }) => {
        setRoomOptions(
          (rooms || []).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        )
      })
  }, [reloadToken])

  // Categorias derivadas do config — sem consulta extra ao banco
  const categoriaOptions = useMemo(() => {
    if (!canSeeAll) return CATEGORIAS_POR_DOMINIO['TI'] || []
    if (filterDominio && CATEGORIAS_POR_DOMINIO[filterDominio]) return CATEGORIAS_POR_DOMINIO[filterDominio]
    return Object.values(CATEGORIAS_POR_DOMINIO).flat()
  }, [canSeeAll, filterDominio])

  useEffect(() => {
    let cancelled = false
    setData(null)

    const load = async () => {
      // Busca IDs de equipamentos pelo nome para text search cross-join
      let eqIds = null
      const sq = searchDebounced.trim()
      if (sq) {
        const { data: matchEq } = await supabase
          .from('equipment')
          .select('id')
          .ilike('name', `%${sq}%`)
          .is('deleted_at', null)
        if (cancelled) return
        eqIds = (matchEq || []).map((e) => e.id)
      }

      const applyFilters = (q) => {
        if (!canSeeAll)      q = q.eq('equipment.dominio', 'TI')
        if (filterRoom)      q = q.eq('current_room_id', filterRoom)
        if (filterDominio)   q = q.eq('equipment.dominio', filterDominio)
        if (filterCat)       q = q.eq('equipment.categoria', filterCat)
        if (filterStatus)    q = q.eq('equipment.status', filterStatus)
        if (filterMovedFrom) q = q.gte('moved_at', `${filterMovedFrom}T00:00:00`)
        if (filterMovedTo)   q = q.lte('moved_at', `${filterMovedTo}T23:59:59`)
        if (sq) {
          const conds = [
            `asset_number.ilike.%${sq}%`,
            `serial_number.ilike.%${sq}%`,
            `received_by.ilike.%${sq}%`,
          ]
          if (eqIds && eqIds.length > 0) conds.push(`equipment_id.in.(${eqIds.join(',')})`)
          q = q.or(conds.join(','))
        }
        return q
      }

      const applySort = (q) => {
        switch (sort) {
          case 'za':        return q.order('name', { referencedTable: 'equipment', ascending: false })
          case 'pat':       return q.order('asset_number', { ascending: true, nullsFirst: false })
          case 'sala':      return q.order('name', { referencedTable: 'room', ascending: true })
          case 'cat':       return q.order('categoria', { referencedTable: 'equipment', ascending: true })
          case 'data_desc': return q.order('moved_at', { ascending: false })
          case 'data_asc':  return q.order('moved_at', { ascending: true })
          default:          return q.order('name', { referencedTable: 'equipment', ascending: true })
        }
      }

      const from = (page - 1) * PAGE_SIZE
      const [pageRes, countRes] = await Promise.all([
        applySort(applyFilters(
          supabase
            .from('equipment_locations')
            .select('equipment_id, equipment!inner(name,categoria,status,observacao,dominio), asset_number, serial_number, received_by, moved_at, current_room_id, room:current_room_id(id,name)')
            .not('current_room_id', 'is', null),
        )).range(from, from + PAGE_SIZE - 1),
        applyFilters(
          supabase
            .from('equipment_locations')
            .select('equipment!inner(id)', { count: 'exact', head: true })
            .not('current_room_id', 'is', null),
        ),
      ])

      if (cancelled) return
      if (pageRes.error) {
        showToastRef.current(pageRes.error.message, 'danger')
        setData([])
        return
      }

      const locations = pageRes.data || []

      // Fallback de received_by via asset_movements apenas para a página atual
      const assetNums = locations.map((l) => l.asset_number).filter(Boolean)
      let receiverByAsset = {}
      if (assetNums.length > 0) {
        const { data: movs } = await supabase
          .from('asset_movements')
          .select('asset_number, received_by, moved_at')
          .in('asset_number', assetNums)
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })
        if (cancelled) return
        ;(movs || []).forEach((m) => {
          if (!receiverByAsset[m.asset_number]) receiverByAsset[m.asset_number] = m.received_by || null
        })
      }

      const items = locations.map((m) => {
        const key = m.asset_number
          ? `pat_${m.asset_number}`
          : m.serial_number
            ? `eq_${m.equipment_id}_ser_${m.serial_number}`
            : `eq_${m.equipment_id}`
        return {
          key,
          equipment_id: m.equipment_id,
          equipment: m.equipment,
          dominio: m.equipment?.dominio || 'TI',
          categoria: m.equipment?.categoria || null,
          status: m.equipment?.status || null,
          observacao: m.equipment?.observacao || null,
          asset_number: m.asset_number || null,
          serial_number: m.serial_number || null,
          received_by: m.received_by || receiverByAsset[m.asset_number] || null,
          moved_at: m.moved_at || null,
          destination_room_id: m.current_room_id,
          current_room_id: m.current_room_id,
          moved_by: null,
          room: m.room || null,
          profile: null,
        }
      })

      setData(items)
      setTotal(countRes.count || 0)
    }

    load().catch((err) => {
      if (!cancelled) {
        showToastRef.current(err?.message || 'Erro inesperado', 'danger')
        setData([])
      }
    })

    return () => { cancelled = true }
  }, [page, searchDebounced, filterRoom, filterDominio, filterCat, filterStatus, filterMovedFrom, filterMovedTo, sort, reloadToken, canSeeAll])

  useEffect(() => {
    setPage(1)
    setSelectedKeys(new Set())
  }, [searchDebounced, filterRoom, filterDominio, filterCat, filterStatus, filterMovedFrom, filterMovedTo, sort])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > totalPages) setPage(totalPages)
  }, [page, total])

  const onPrev = () => setPage((p) => Math.max(1, p - 1))
  const onNext = () => setPage((p) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    return Math.min(totalPages, p + 1)
  })

  const fetchAllForExport = async () => {
    const sq = searchDebounced.trim()
    let eqIds = null
    if (sq) {
      const { data: matchEq } = await supabase
        .from('equipment')
        .select('id')
        .ilike('name', `%${sq}%`)
        .is('deleted_at', null)
      eqIds = (matchEq || []).map((e) => e.id)
    }

    let q = supabase
      .from('equipment_locations')
      .select('equipment_id, equipment!inner(name,categoria,status,observacao,dominio), asset_number, serial_number, received_by, moved_at, current_room_id, room:current_room_id(id,name)')
      .not('current_room_id', 'is', null)

    if (!canSeeAll)      q = q.eq('equipment.dominio', 'TI')
    if (filterRoom)      q = q.eq('current_room_id', filterRoom)
    if (filterDominio)   q = q.eq('equipment.dominio', filterDominio)
    if (filterCat)       q = q.eq('equipment.categoria', filterCat)
    if (filterStatus)    q = q.eq('equipment.status', filterStatus)
    if (filterMovedFrom) q = q.gte('moved_at', `${filterMovedFrom}T00:00:00`)
    if (filterMovedTo)   q = q.lte('moved_at', `${filterMovedTo}T23:59:59`)
    if (sq) {
      const conds = [
        `asset_number.ilike.%${sq}%`,
        `serial_number.ilike.%${sq}%`,
        `received_by.ilike.%${sq}%`,
      ]
      if (eqIds && eqIds.length > 0) conds.push(`equipment_id.in.(${eqIds.join(',')})`)
      q = q.or(conds.join(','))
    }
    switch (sort) {
      case 'za':        q = q.order('name', { referencedTable: 'equipment', ascending: false }); break
      case 'pat':       q = q.order('asset_number', { ascending: true, nullsFirst: false }); break
      case 'sala':      q = q.order('name', { referencedTable: 'room', ascending: true }); break
      case 'cat':       q = q.order('categoria', { referencedTable: 'equipment', ascending: true }); break
      case 'data_desc': q = q.order('moved_at', { ascending: false }); break
      case 'data_asc':  q = q.order('moved_at', { ascending: true }); break
      default:          q = q.order('name', { referencedTable: 'equipment', ascending: true }); break
    }

    const { data: locations, error } = await q
    if (error) throw error
    return (locations || []).map((m) => ({
      equipment: m.equipment,
      categoria: m.equipment?.categoria || null,
      status: m.equipment?.status || null,
      observacao: m.equipment?.observacao || null,
      asset_number: m.asset_number || null,
      serial_number: m.serial_number || null,
      received_by: m.received_by || null,
      moved_at: m.moved_at || null,
      room: m.room || null,
    }))
  }

  const exportExcel = async (scope = 'all') => {
    try {
      let rows
      if (scope === 'page') {
        rows = data || []
      } else {
        rows = await fetchAllForExport()
      }
      if (rows.length === 0) {
        showToast('Nenhum equipamento para exportar.', 'warning')
        return
      }
      const wsData = [
        ['Equipamento', 'Categoria', 'Status', 'Nº Patrimônio', 'Nº Série', 'Localização Atual', 'Com quem está', 'Último Registro', 'Observação'],
        ...rows.map((d) => [
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
      const suffix = scope === 'page' ? `_pagina${page}` : ''
      await exportXlsx({
        fileName: `registro${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheets: [{ name: 'Registro', rows: wsData, columns: [30, 16, 12, 18, 18, 22, 24, 20, 30] }],
      })
      showToast(`${rows.length} equipamento${rows.length !== 1 ? 's exportados' : ' exportado'}!`, 'success')
    } catch (err) {
      console.error('exportExcel erro:', err)
      showToast('Erro ao exportar: ' + (err?.message || 'falha inesperada'), 'danger')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setSearchDebounced('')
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

  const allPageSelected =
    (data?.length ?? 0) > 0 && (data || []).every((d) => selectedKeys.has(d.key))

  const toggleAllPage = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        ;(data || []).forEach((d) => next.delete(d.key))
      } else {
        ;(data || []).forEach((d) => next.add(d.key))
      }
      return next
    })
  }, [data, allPageSelected])

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), [])

  const selectedItems = useMemo(
    () => (data || []).filter((d) => selectedKeys.has(d.key)),
    [data, selectedKeys],
  )

  const exportSelected = async () => {
    try {
      if (selectedItems.length === 0) return
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
      await exportXlsx({
        fileName: `registro_selecionados_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheets: [{ name: 'Selecionados', rows: wsData, columns: [30, 16, 12, 18, 18, 22, 24, 20, 30] }],
      })
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
          {canEdit && (
            <>
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
            </>
          )}
          <div className="export-menu-wrapper">
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#059669' }}
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={total === 0}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              title={total === 0 ? 'Sem itens para exportar' : 'Exportar registros'}
            >
              <FileSpreadsheet size={14} /> Exportar
              <ChevronDown size={14} style={{ marginLeft: 2 }} />
            </button>
            {exportMenuOpen && (
              <>
                <div className="export-menu-backdrop" onClick={() => setExportMenuOpen(false)} />
                <div className="export-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="export-menu-item"
                    onClick={() => {
                      setExportMenuOpen(false)
                      exportExcel('page')
                    }}
                  >
                    <div className="export-menu-item-title">Esta página</div>
                    <div className="export-menu-item-desc">
                      Exporta os {(data || []).length} registros visíveis (página {page}).
                    </div>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="export-menu-item"
                    onClick={() => {
                      setExportMenuOpen(false)
                      exportExcel('all')
                    }}
                  >
                    <div className="export-menu-item-title">Todos os resultados filtrados</div>
                    <div className="export-menu-item-desc">
                      Exporta os {total.toLocaleString('pt-BR')} registro{total !== 1 ? 's' : ''} que correspondem aos filtros atuais.
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
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
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {canSeeAll && (
            <div className="filter-group">
              <label className="filter-label">Classificação</label>
              <select
                className="form-control filter-control"
                value={filterDominio}
                onChange={(e) => setFilterDominio(e.target.value)}
              >
                <option value="">Todos</option>
                {DOMINIOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label className="filter-label">Categoria</label>
            <select
              className="form-control filter-control"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Todas</option>
              {categoriaOptions.map((c) => (
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
              type="date"
              className="form-control filter-control"
              value={filterMovedFrom}
              onChange={(e) => setFilterMovedFrom(e.target.value)}
            />
          </div>
          <div className="filter-group" style={{ flex: 1 }}>
            <label className="filter-label">Último registro até</label>
            <input
              type="date"
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
            {total} equipamento{total !== 1 ? 's' : ''}
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
            {canEdit && (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setBulkMovementModalOpen(true)}
                >
                  <ArrowRightLeft size={14} /><span className="btn-text">Movimentar para outra sala</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#64748b' }}
                  onClick={() => setBulkModalOpen(true)}
                >
                  <ArrowRightLeft size={14} /><span className="btn-text"> Atualizar registro de {selectedItems.length}</span>
                </button>
              </>
            )}
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
                  checked={allPageSelected}
                  onChange={toggleAllPage}
                  aria-label="Selecionar todos os equipamentos desta página"
                />
              </th>
              <th>Equipamento</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Nº Patrimônio</th>
              <th>Localização Atual</th>
              <th>Com quem está</th>
              <th>Último Registro</th>
              <th style={{ width: 144 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
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
              data.map((d) => (
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
                    <div className="table-actions">
                      {canEdit && (
                        <button
                          className="btn-table-action edit"
                          onClick={(e) => { e.stopPropagation(); setEditRegistroItem(d) }}
                          title="Editar equipamento"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button
                        className="btn-table-action edit"
                        onClick={(e) => { e.stopPropagation(); setHistoryEq(d) }}
                        title="Ver hist\u00f3rico"
                      >
                        <History size={14} />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          className="btn-table-action"
                          style={{ color: '#dc2626' }}
                          onClick={(e) => { e.stopPropagation(); setDeleteItem(d) }}
                          title="Excluir equipamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPrev={onPrev} onNext={onNext} />

      {historyEq && (
        <HistoryModal item={historyEq} onClose={() => setHistoryEq(null)} />
      )}

      {editRegistroItem && (
        <EditRegistroEquipmentModal
          item={editRegistroItem}
          roomsFetcher={roomsFetcher}
          equipmentFetcher={equipmentFetcher}
          invalidate={invalidate}
          onClose={() => setEditRegistroItem(null)}
          onSaved={() => {
            setEditRegistroItem(null)
            refetch()
          }}
        />
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

      {bulkMovementModalOpen && (
        <BulkMovementModal
          items={selectedItems}
          user={user}
          onClose={() => setBulkMovementModalOpen(false)}
          onSuccess={() => {
            setBulkMovementModalOpen(false)
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
          onSaved={(payload) => {
            setNewRegistroAsset(null)
            refetch()
            if (payload?.isPrinter) {
              navigate('/impressoras', {
                state: {
                  printerAsset: {
                    assetNumber: payload.assetNumber,
                    equipmentId: payload.equipmentId,
                    equipmentName: payload.equipmentName,
                    roomId: payload.roomId,
                  },
                },
              })
            }
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

      {deleteItem && (
        <DeleteEquipmentModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDeleted={() => { setDeleteItem(null); refetch() }}
        />
      )}
    </>
  )
}

