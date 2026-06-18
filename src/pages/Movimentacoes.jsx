import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
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
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { Pagination } from '../components/Pagination.jsx'
import { Scanner, ScanResultModal } from '../components/Scanner.jsx'
import {
  formatAssetNumber,
  normalizeAssetNumber,
  normalizeText,
  fmtDateTime,
} from '../utils/format.js'
import { exportXlsx, readFirstSheetAsObjects } from '../utils/spreadsheet.js'
import { ROLES_FULL_ACCESS } from '../config/dominios.js'
import { PAGE_SIZE } from "./Movimentacoes.shared.jsx"
import {
  CreateModal,
  LoteModal,
  EditModal,
  EditInfoModal,
  ImportPreviewModal,
} from "./Movimentacoes.modals.jsx"

function buildQuery(filters, { page, count = false, pageSize = PAGE_SIZE, tiOnly = false }) {
  let q = supabase
    .from('asset_movements')
    .select(tiOnly ? '*, equipment!inner(name,dominio)' : '*, equipment(name)', count ? { count: 'exact' } : {})
    .is('deleted_at', null)
  if (tiOnly) q = q.eq('equipment.dominio', 'TI')
  if (filters.dateFrom)
    q = q.gte('moved_at', new Date(filters.dateFrom + 'T00:00:00').toISOString())
  if (filters.dateTo)
    q = q.lte('moved_at', new Date(filters.dateTo + 'T23:59:59').toISOString())
  if (filters.equipmentId) q = q.eq('equipment_id', filters.equipmentId)
  if (filters.categoriaIds && filters.categoriaIds.length > 0)
    q = q.in('equipment_id', filters.categoriaIds)
  if (filters.originId) q = q.eq('origin_room_id', filters.originId)
  if (filters.destId) q = q.eq('destination_room_id', filters.destId)
  if (filters.responsible) q = q.eq('moved_by', filters.responsible)
  if (filters.assetDigits) q = q.ilike('asset_number', `%${filters.assetDigits}%`)
  if (filters.search) {
    const term = filters.search.replace(/[%_]/g, '')
    q = q.or(
      `serial_number.ilike.%${term}%,asset_number.ilike.%${term}%,received_by.ilike.%${term}%`,
    )
  }
  q = q.order('moved_at', { ascending: false })
  const from = (page - 1) * pageSize
  return q.range(from, from + pageSize - 1)
}

export function Movimentacoes() {
  const { search, registerRefresh } = useOutletContext()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { rooms: roomsFetcher, equipment: equipmentFetcher, profiles: profilesFetcher, invalidate } =
    useStore()
  const { showToast, showUndoToast, confirm } = useToast()
  const audit = useAudit()
  const isAdmin = user?.role === 'admin'
  const canEditMovements = isAdmin || user?.role === 'tecnico'
  const tiOnly = !ROLES_FULL_ACCESS.includes(user?.role)

  const [list, setList] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const refreshRef = useRef(null)

  // Detecta movimentações em lote: mesmo moved_at + moved_by = bulk move
  const listWithBatch = useMemo(() => {
    if (!list) return null
    const countMap = {}
    list.forEach((m) => {
      const key = `${m.moved_at}|${m.moved_by}`
      countMap[key] = (countMap[key] || 0) + 1
    })
    return list.map((m) => ({ ...m, isBatch: countMap[`${m.moved_at}|${m.moved_by}`] >= 2 }))
  }, [list])

  const [equipment, setEquipment] = useState([])
  const [rooms, setRooms] = useState([])
  const [profilesList, setProfilesList] = useState([])

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    equipmentId: '',
    categoria: '',
    categoriaIds: [],
    originId: '',
    destId: '',
    responsible: '',
    assetDigits: '',
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [loteOpen, setLoteOpen] = useState(false)
  const [editMov, setEditMov] = useState(null)
  const [editInfoMovId, setEditInfoMovId] = useState(null)
  const [importRows, setImportRows] = useState(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // ── Seleção múltipla ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const allPageSelected = useMemo(
    () => listWithBatch?.length > 0 && listWithBatch.every((m) => selectedIds.has(m.id)),
    [listWithBatch, selectedIds],
  )

  const toggleAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        listWithBatch.forEach((m) => next.delete(m.id))
      } else {
        listWithBatch.forEach((m) => next.add(m.id))
      }
      return next
    })
  }, [listWithBatch, allPageSelected])

  const exportSelected = async () => {
    try {
      const selected = (listWithBatch || []).filter((m) => selectedIds.has(m.id))
      if (selected.length === 0) return
      const wsData = [
        ['Equipamento', 'Nº Série', 'Nº Patrimônio', 'Origem', 'Destino', 'Responsável', 'Com quem está', 'Data / Hora', 'Última edição', 'Último Editor'],
        ...selected.map((m) => [
          m.equipment?.name || '—',
          m.serial_number || '—',
          formatAssetNumber(m.asset_number) || '—',
          m.origin?.name || '—',
          m.destination?.name || '—',
          m.profiles?.full_name || '—',
          m.received_by || '—',
          new Date(m.moved_at).toLocaleString('pt-BR'),
          m.edited_at ? new Date(m.edited_at).toLocaleString('pt-BR') : '—',
          m.editedBy?.full_name || '—',
        ]),
      ]
      await exportXlsx({
        fileName: `movimentacoes_selecionadas_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheets: [{ name: 'Selecionadas', rows: wsData, columns: [30, 18, 18, 22, 22, 24, 24, 20, 20, 24] }],
      })
      showToast(`${selected.length} linha${selected.length !== 1 ? 's' : ''} exportada${selected.length !== 1 ? 's' : ''}!`, 'success')
    } catch (err) {
      showToast('Erro ao exportar: ' + (err?.message || 'falha inesperada'), 'danger')
    }
  }

  const deleteSelected = async () => {
    const ids = [...selectedIds]
    const count = ids.length
    const ok = await confirm({
      title: `Excluir ${count} movimentaç${count !== 1 ? 'ões' : 'ão'}`,
      message: `Tem certeza que deseja excluir ${count} movimentaç${count !== 1 ? 'ões selecionadas' : 'ão selecionada'}? Esta ação não pode ser desfeita facilmente.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase
      .from('asset_movements')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .is('deleted_at', null)
    if (error) { showToast('Erro ao excluir: ' + error.message, 'danger'); return }
    audit.log('delete', 'asset_movements', null, { ids, count })
    clearSelection()
    showToast(`${count} movimentaç${count !== 1 ? 'ões excluídas' : 'ão excluída'}.`, 'success')
    refresh()
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanMode, setScanMode] = useState('single')
  const [scanResult, setScanResult] = useState(null)
  const [createPrefill, setCreatePrefill] = useState(null)

  useEffect(() => {
    const modalState = location.state?.openCreateModal
    if (!modalState) return

    const prefill =
      typeof modalState === 'object'
        ? {
            asset: modalState.prefillAsset || '',
            originId: modalState.prefillOriginId || '',
            originName: modalState.prefillOriginName || '',
          }
        : null
    setCreatePrefill(prefill?.asset || prefill?.originId ? prefill : null)
    setCreateOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const [loteItems, setLoteItems] = useState([])
  const [loteUid, setLoteUid] = useState(0)
  const [loteOriginId, setLoteOriginId] = useState('')
  const [loteOriginName, setLoteOriginName] = useState('')
  const [loteDestId, setLoteDestId] = useState('')
  const [loteDestName, setLoteDestName] = useState('')
  const [loteReceivedBy, setLoteReceivedBy] = useState('')
  const [loteReceivedByProfileId, setLoteReceivedByProfileId] = useState('')
  const [loteItemStatus, setLoteItemStatus] = useState('')
  const [loteComentario, setLoteComentario] = useState('')
  const [loteBusy, setLoteBusy] = useState(false)

  const fileInputRef = useRef(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const loadDropdowns = useCallback(async () => {
    const [eq, rm, pr] = await Promise.all([
      equipmentFetcher(),
      roomsFetcher(),
      profilesFetcher(),
    ])
    setEquipment(eq)
    setRooms(rm)
    setProfilesList(pr)
  }, [equipmentFetcher, roomsFetcher, profilesFetcher])

  useEffect(() => {
    loadDropdowns()
  }, [loadDropdowns])

  const fetchPage = useCallback(
    async (p, currentFilters = filters, currentSearch = search) => {
      setList(null)
      const f = { ...currentFilters, search: currentSearch || '' }
      const { data, count, error } = await buildQuery(f, { page: p, count: true, tiOnly })
      if (error) {
        showToast('Erro ao carregar movimentações: ' + error.message, 'danger')
        setList([])
        return
      }
      const assetNumbers = [...new Set((data || []).map((m) => m.asset_number).filter(Boolean))]
      const [rm, pr, locResult] = await Promise.all([
        roomsFetcher(),
        profilesFetcher(),
        assetNumbers.length > 0
          ? supabase
              .from('equipment_locations')
              .select('asset_number, equipment_id, equipment:equipment_id(name)')
              .in('asset_number', assetNumbers)
          : Promise.resolve({ data: [] }),
      ])
      const roomMap = Object.fromEntries(rm.map((r) => [r.id, r]))
      const profileMap = Object.fromEntries(pr.map((p2) => [p2.id, p2]))
      const locationMap = Object.fromEntries((locResult.data || []).map((loc) => [loc.asset_number, loc]))
      setList(
        (data || []).map((m) => ({
          ...m,
          equipment_id: locationMap[m.asset_number]?.equipment_id || m.equipment_id,
          equipment: locationMap[m.asset_number]?.equipment || m.equipment,
          origin: roomMap[m.origin_room_id] || null,
          destination: roomMap[m.destination_room_id] || null,
          profiles: profileMap[m.moved_by] || null,
          editedBy: profileMap[m.edited_by] || null,
        })),
      )
      setTotal(count || 0)
    },
    [roomsFetcher, profilesFetcher, showToast],
  )

  // Único useEffect responsável pela primeira carga + recarrega quando search muda.
  // Antes existiam DOIS useEffects (um com `[search]`, outro com `[]`) que
  // disparavam fetches paralelos no mount, fazendo a primeira página ser
  // requisitada duas vezes em paralelo.
  useEffect(() => {
    setPage(1)
    fetchPage(1, filtersRef.current, search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const applyFilters = () => {
    setPage(1)
    clearSelection()
    fetchPage(1, filters, search)
  }

  const categorias = useMemo(
    () => [...new Set(equipment.filter((e) => e.categoria).map((e) => e.categoria))].sort(),
    [equipment],
  )

  const setCategoriaFilter = (cat) => {
    const ids = cat ? equipment.filter((e) => e.categoria === cat).map((e) => e.id) : []
    setFilters((f) => ({ ...f, categoria: cat, categoriaIds: ids }))
  }

  const clearFilters = () => {
    const cleared = {
      dateFrom: '',
      dateTo: '',
      equipmentId: '',
      categoria: '',
      categoriaIds: [],
      originId: '',
      destId: '',
      responsible: '',
      assetDigits: '',
    }
    setFilters(cleared)
    setPage(1)
    clearSelection()
    fetchPage(1, cleared, search)
  }

  const refresh = () => fetchPage(page, filters, search)
  refreshRef.current = refresh

  useEffect(() => {
    registerRefresh?.(() => refreshRef.current?.())
    return () => registerRefresh?.(null)
  }, [registerRefresh])

  const onPrev = () => {
    const p = page - 1
    setPage(p)
    clearSelection()
    fetchPage(p, filters, search)
    window.scrollTo(0, 0)
  }

  const onNext = () => {
    const p = page + 1
    setPage(p)
    clearSelection()
    fetchPage(p, filters, search)
    window.scrollTo(0, 0)
  }

  const deleteMov = async (id) => {
    const ok = await confirm({
      title: 'Excluir movimentação',
      message: 'Tem certeza que deseja excluir esta movimentação?',
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase
      .from('asset_movements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) { showToast('Erro ao excluir: ' + error.message, 'danger'); return }
    audit.deleted('asset_movements', id)
    refresh()
    showUndoToast('Movimentação excluída.', async () => {
      await supabase.from('asset_movements').update({ deleted_at: null }).eq('id', id)
      refresh()
    })
  }


  // scope: 'page' = só a página visível (rápido) | 'all' = todos os filtrados
  const exportExcel = async (scope = 'all') => {
    try {
      const f = { ...filters, search: search || '' }
      const [rm, pr] = await Promise.all([roomsFetcher(), profilesFetcher()])
      const roomMap = Object.fromEntries(rm.map((r) => [r.id, r]))
      const profileMap = Object.fromEntries(pr.map((p2) => [p2.id, p2]))

      let all = []
      if (scope === 'page') {
        // Só a página visível — usa o PAGE_SIZE padrão.
        const { data, error } = await buildQuery(f, { page, count: false, tiOnly })
        if (error) {
          showToast('Erro ao exportar: ' + error.message, 'danger')
          return
        }
        all = data || []
      } else {
        // Todos os filtrados — busca em lotes de 1000 (limite de segurança 20k).
        showToast('Preparando exportação completa...', 'success')
        const BATCH = 1000
        let p2 = 1
        while (true) {
          const { data, error } = await buildQuery(f, {
            page: p2,
            count: false,
            pageSize: BATCH,
            tiOnly,
          })
          if (error) {
            showToast('Erro ao exportar: ' + error.message, 'danger')
            return
          }
          all = all.concat(data || [])
          if (!data || data.length < BATCH) break
          p2++
          if (all.length >= 20000) {
            showToast('Limite de 20.000 linhas atingido. Filtre mais para exportar tudo.', 'warning')
            break
          }
        }
      }

      if (all.length === 0) {
        showToast('Nenhuma movimentação para exportar.', 'warning')
        return
      }
      const exportAssets = [...new Set(all.map((m) => m.asset_number).filter(Boolean))]
      const { data: exportLocations } = exportAssets.length > 0
        ? await supabase
            .from('equipment_locations')
            .select('asset_number, equipment:equipment_id(name)')
            .in('asset_number', exportAssets)
        : { data: [] }
      const exportLocationMap = Object.fromEntries((exportLocations || []).map((loc) => [loc.asset_number, loc]))
      const wsData = [
        ['Equipamento', 'Nº Série', 'Nº Patrimônio', 'Origem', 'Destino', 'Responsável', 'Com quem está', 'Data / Hora', 'Última edição', 'Último Editor'],
        ...all.map((m) => [
          exportLocationMap[m.asset_number]?.equipment?.name || m.equipment?.name || '—',
          m.serial_number || '—',
          formatAssetNumber(m.asset_number) || '—',
          roomMap[m.origin_room_id]?.name || '—',
          roomMap[m.destination_room_id]?.name || '—',
          profileMap[m.moved_by]?.full_name || '—',
          m.received_by || '—',
          new Date(m.moved_at).toLocaleString('pt-BR'),
          m.edited_at ? new Date(m.edited_at).toLocaleString('pt-BR') : '—',
          profileMap[m.edited_by]?.full_name || '—',
        ]),
      ]
      const suffix = scope === 'page' ? `_pagina${page}` : ''
      await exportXlsx({
        fileName: `movimentacoes${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheets: [{ name: 'Movimentações', rows: wsData, columns: [30, 18, 18, 22, 22, 24, 24, 20, 20, 24] }],
      })
      showToast(`${all.length} linha${all.length !== 1 ? 's' : ''} exportada${all.length !== 1 ? 's' : ''}!`, 'success')
    } catch (err) {
      console.error('exportExcel erro:', err)
      showToast('Erro ao exportar: ' + (err?.message || 'falha inesperada'), 'danger')
    }
  }

  const handleImportFile = async (e) => {
    if (!isAdmin) {
      showToast('Acesso restrito a administradores.', 'danger')
      return
    }
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('Arquivo muito grande (máximo 5 MB). Divida em planilhas menores.', 'warning')
      return
    }
    const raw = await readFirstSheetAsObjects(file)

    const parseDate = (val) => {
      if (!val) return null
      if (val instanceof Date) return val
      const s = val.toString().trim()
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
      if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0))
      const d = new Date(s)
      return isNaN(d) ? null : d
    }

    // Mapas de lookup por nome normalizado (sem acento/minúsculas) para casar
    // os nomes da planilha com os registros cadastrados.
    const normalize = (s) => normalizeText(s).trim()
    const eqByName = Object.fromEntries(equipment.map((it) => [normalize(it.name), it]))
    const roomByName = Object.fromEntries(rooms.map((r) => [normalize(r.name), r]))

    const rows = raw.map((row) => {
      const equipmentName = (row['Equipamento'] || '').toString().trim()
      const serialNumber = (row['Nº Série'] || '').toString().trim() || null
      const assetNumber = (row['Nº Patrimônio'] || '').toString().trim() || null
      const originName = (row['Origem'] || '').toString().trim()
      const destName = (row['Destino'] || '').toString().trim()
      const receivedBy = (row['Recebedor'] || '').toString().trim() || null
      const movedAt = parseDate(row['Data / Hora'])

      const eqMatch = eqByName[normalize(equipmentName)]
      const origin = originName ? roomByName[normalize(originName)] : null
      const dest = destName ? roomByName[normalize(destName)] : null

      const errors = []
      const warnings = []
      if (!equipmentName) errors.push('Equipamento não informado')
      else if (!eqMatch) errors.push('Equipamento não encontrado no cadastro')
      if (!destName) errors.push('Destino não informado')
      else if (!dest) errors.push('Sala de destino não encontrada no cadastro')
      if (originName && !origin) warnings.push('Sala de origem não encontrada — ficará em branco')
      if (!movedAt) warnings.push('Data inválida ou ausente — será usada a data/hora atual')

      return {
        equipmentName,
        serialNumber,
        assetNumber,
        originName,
        destName,
        receivedBy,
        equipmentId: eqMatch?.id || null,
        originId: origin?.id || null,
        destId: dest?.id || null,
        movedAt,
        movedAtDisplay: movedAt ? movedAt.toLocaleString('pt-BR') : null,
        status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warn' : 'ok',
        errors,
        warnings,
      }
    })

    setImportRows(rows)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const confirmImport = async () => {
    const validRows = (importRows || []).filter((r) => r.status !== 'error')
    if (validRows.length === 0) {
      showToast('Nenhuma linha válida para importar.', 'warning')
      return
    }
    const inserts = validRows.map((r) => ({
      equipment_id: r.equipmentId,
      serial_number: r.serialNumber || null,
      asset_number: r.assetNumber || null,
      origin_room_id: r.originId || null,
      destination_room_id: r.destId,
      moved_by: user.id,
      received_by: r.receivedBy || null,
      moved_at: r.movedAt ? r.movedAt.toISOString() : new Date().toISOString(),
    }))
    const { error } = await supabase.from('asset_movements').insert(inserts)
    if (error) {
      showToast('Erro ao importar: ' + error.message, 'danger')
      return
    }
    audit.log('import', 'asset_movements', null, { count: inserts.length })
    setImportRows(null)
    showToast(
      `${inserts.length} movimentaç${inserts.length !== 1 ? 'ões importadas' : 'ão importada'} com sucesso!`,
      'success',
    )
    setPage(1)
    fetchPage(1, filters, search)
  }

  const onMaquinaLocalizada = (mov, assetNumber) => {
    setScannerOpen(false)
    setScanResult({ mov, assetNumber })
  }

  const onSemHistorico = (assetNumber) => {
    setScannerOpen(false)
    navigate('/registro', { state: { newRegistroAsset: assetNumber } })
  }

  const onScanRegist = () => {
    const mov = scanResult?.mov
    setScanResult(null)
    setCreatePrefill({
      asset: scanResult?.assetNumber || '',
      originId: mov?.destination_room?.id || '',
      originName: mov?.destination_room?.name || '',
    })
    setCreateOpen(true)
  }

  const openScanLote = () => {
    setScanMode('lote')
    setScannerOpen(true)
  }

  const onLoteItem = (assetNumber, equipmentId, equipmentName) => {
    const isDuplicate = loteItems.some((i) => i.assetNumber === assetNumber)
    if (isDuplicate) return false
    const uid = loteUid + 1
    setLoteUid(uid)
    setLoteItems((prev) => [
      ...prev,
      { uid, assetNumber, equipmentId, equipmentName, serialNumber: '' },
    ])
    return true
  }

  const onConcluirLote = () => {
    setScannerOpen(false)
  }

  const submitLote = async (e) => {
    e.preventDefault()
    if (!loteDestId) { showToast('Selecione a sala de destino.', 'warning'); return }
    if (loteItems.length === 0) { showToast('Adicione ao menos um patrimônio.', 'warning'); return }
    const assetNumbers = loteItems.map((item) => normalizeAssetNumber(item.assetNumber)).filter(Boolean)
    if (assetNumbers.length !== loteItems.length) {
      showToast('Preencha o Nº Patrimônio de todos os itens.', 'warning')
      return
    }
    const { data: registrations, error: regError } = await supabase
      .from('equipment_locations')
      .select('asset_number, equipment_id, serial_number, current_room_id')
      .in('asset_number', assetNumbers)
    if (regError) {
      showToast('Erro ao verificar registros: ' + regError.message, 'danger')
      return
    }
    const regMap = Object.fromEntries((registrations || []).map((reg) => [reg.asset_number, reg]))
    const missing = assetNumbers.filter((assetNumber) => !regMap[assetNumber]?.equipment_id)
    if (missing.length > 0) {
      showToast(`Patrimônio sem registro: ${missing.slice(0, 3).map(formatAssetNumber).join(', ')}${missing.length > 3 ? '...' : ''}`, 'warning')
      return
    }
    const withoutOrigin = assetNumbers.filter((assetNumber) => !regMap[assetNumber]?.current_room_id)
    if (withoutOrigin.length > 0) {
      showToast(`Patrimônio sem localização atual: ${withoutOrigin.slice(0, 3).map(formatAssetNumber).join(', ')}${withoutOrigin.length > 3 ? '...' : ''}`, 'warning')
      return
    }
    const alreadyAtDestination = assetNumbers.filter((assetNumber) => regMap[assetNumber]?.current_room_id === loteDestId)
    if (alreadyAtDestination.length > 0) {
      showToast(`Patrimônio já está no destino: ${alreadyAtDestination.slice(0, 3).map(formatAssetNumber).join(', ')}${alreadyAtDestination.length > 3 ? '...' : ''}`, 'warning')
      return
    }
    setLoteBusy(true)
    const movedAt = new Date().toISOString()
    const inserts = loteItems.map((item) => {
      const assetNumber = normalizeAssetNumber(item.assetNumber)
      const registration = regMap[assetNumber]
      return {
        equipment_id: registration.equipment_id,
        serial_number: item.serialNumber || registration.serial_number || null,
        asset_number: assetNumber,
        origin_room_id: registration.current_room_id,
        destination_room_id: loteDestId,
        moved_by: user.id,
        received_by: loteReceivedBy || null,
        received_by_profile_id: loteReceivedByProfileId || null,
        moved_at: movedAt,
        item_status: loteItemStatus || null,
        comentario: loteComentario || null,
      }
    })
    const { data: inserted, error } = await supabase.from('asset_movements').insert(inserts).select('id')
    if (error) {
      showToast('Erro ao registrar: ' + error.message, 'danger')
      setLoteBusy(false)
      return
    }
    const locUpserts = inserts
      .filter((r) => r.asset_number)
      .map((r) => ({
        equipment_id: r.equipment_id,
        asset_number: r.asset_number,
        serial_number: r.serial_number,
        current_room_id: loteDestId,
        moved_at: movedAt,
      }))
    if (locUpserts.length > 0) {
      await supabase
        .from('equipment_locations')
        .upsert(locUpserts, { onConflict: 'asset_number' })
    }
    if (loteItemStatus) {
      const uniqueEqIds = [...new Set(inserts.map((i) => i.equipment_id))]
      for (const eqId of uniqueEqIds) {
        const { error: statusError } = await supabase
          .from('equipment')
          .update({ status: loteItemStatus })
          .eq('id', eqId)
        if (statusError) {
          showToast('Movimentações registradas, mas houve erro ao atualizar o status: ' + statusError.message, 'warning')
          setLoteBusy(false)
          return
        }
      }
      invalidate('equipment')
      loadDropdowns()
    }
    audit.log('batch_movement', 'asset_movements', null, {
      count: inserts.length,
      to: loteDestName,
      movement_ids: (inserted || []).map((r) => r.id),
    })
    closeLote()
    showToast(
      `${inserts.length} movimentaç${inserts.length !== 1 ? 'ões registradas' : 'ão registrada'} com sucesso!`,
      'success',
    )
    setPage(1)
    fetchPage(1, filters, search)
  }

  const closeLote = () => {
    setLoteOpen(false)
    setLoteItems([])
    setLoteUid(0)
    setLoteOriginId('')
    setLoteOriginName('')
    setLoteDestId('')
    setLoteDestName('')
    setLoteReceivedBy('')
    setLoteReceivedByProfileId('')
    setLoteItemStatus('')
    setLoteComentario('')
    setLoteBusy(false)
  }

  const filterCount = [filters.dateFrom, filters.dateTo, filters.equipmentId, filters.categoria, filters.originId, filters.destId, filters.responsible, filters.assetDigits].filter(Boolean).length

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Movimentações</h2>
          <p>Histórico de todas as movimentações de patrimônio.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="export-menu-wrapper">
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#059669' }}
              onClick={() => setExportMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
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
                      Exporta as {Math.min(PAGE_SIZE, list?.length || 0)} linhas visíveis (página {page}).
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
                    <div className="export-menu-item-title">
                      Todos os resultados filtrados
                    </div>
                    <div className="export-menu-item-desc">
                      Exporta as {total.toLocaleString('pt-BR')} linha{total !== 1 ? 's' : ''} que correspondem aos filtros atuais.
                      {total > 5000 && ' Pode demorar alguns segundos.'}
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          {isAdmin && (
            <>
              <button
                className="btn-primary"
                style={{ background: '#6366f1' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> Importar
              </button>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </>
          )}
          {canEditMovements && (
            <>
              <button className="btn-primary" onClick={() => setLoteOpen(true)}>
                <Plus size={14} /> Movimentação em Lote
              </button>
              <button className="btn-primary" onClick={() => { setCreatePrefill(null); setCreateOpen(true) }}>
                <Plus size={14} /> Nova Movimentação
              </button>
            </>
          )}
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
          <div className="filter-group">
            <label className="filter-label">De</label>
            <input type="date" className="form-control filter-control" value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="filter-group">
            <label className="filter-label">Até</label>
            <input type="date" className="form-control filter-control" value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <div className="filter-group" style={{ flex: 1.5 }}>
            <label className="filter-label">Equipamento</label>
            <select className="form-control filter-control" value={filters.equipmentId}
              onChange={(e) => setFilters((f) => ({ ...f, equipmentId: e.target.value }))}>
              <option value="">Todos</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Categoria</label>
            <select className="form-control filter-control" value={filters.categoria}
              onChange={(e) => setCategoriaFilter(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Origem</label>
            <select className="form-control filter-control" value={filters.originId}
              onChange={(e) => setFilters((f) => ({ ...f, originId: e.target.value }))}>
              <option value="">Todas</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Destino</label>
            <select className="form-control filter-control" value={filters.destId}
              onChange={(e) => setFilters((f) => ({ ...f, destId: e.target.value }))}>
              <option value="">Todos</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Responsável</label>
            <select className="form-control filter-control" value={filters.responsible}
              onChange={(e) => setFilters((f) => ({ ...f, responsible: e.target.value }))}>
              <option value="">Todos</option>
              {profilesList.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Nº Patrimônio</label>
            <input type="text" className="form-control filter-control" placeholder="Dígitos do PAT"
              value={filters.assetDigits}
              onChange={(e) => setFilters((f) => ({ ...f, assetDigits: e.target.value.replace(/\D/g, '') }))} />
          </div>
        </div>
        </div>
        <div className="filter-actions">
          <span className="filter-count">
            {total} resultado{total !== 1 ? 's' : ''}
          </span>
          <button className="btn-filter-clear" onClick={clearFilters}>
            <X size={13} /> Limpar
          </button>
          <button className="btn-primary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={applyFilters}>
            Filtrar
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-action-bar fade-in">
          <div className="bulk-action-info">
            <Check size={16} />
            <strong>{selectedIds.size}</strong> selecionada{selectedIds.size !== 1 ? 's' : ''}
          </div>
          <div className="bulk-action-buttons">
            <button type="button" className="btn-primary" style={{ background: '#059669' }} onClick={exportSelected}>
              <FileSpreadsheet size={14} /><span className="btn-text"> Exportar Excel</span>
            </button>
            {isAdmin && (
              <button type="button" className="btn-primary" style={{ background: '#dc2626' }} onClick={deleteSelected}>
                <Trash2 size={14} /><span className="btn-text"> Excluir {selectedIds.size} {selectedIds.size === 1 ? 'movimentação' : 'movimentações'}</span>
              </button>
            )}
            <button type="button" className="btn-filter-clear" onClick={clearSelection}>
              <X size={13} /><span className="btn-text"> Limpar seleção</span>
            </button>
          </div>
        </div>
      )}

      {!listWithBatch ? (
        <SkeletonTable />
      ) : (
        <>
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
                      aria-label="Selecionar todas desta página"
                    />
                  </th>
                  <th>Equipamento</th>
                  <th>Nº Série / Patrimônio</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Responsável</th>
                  <th>Com quem está</th>
                  <th>Data / Hora</th>
                  <th>Última edição</th>
                  <th>Último Editor</th>
                  <th style={{ width: 120 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listWithBatch.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                ) : (
                  listWithBatch.map((m) => (
                    <tr
                      key={m.id}
                      className={selectedIds.has(m.id) ? 'row-selected' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return
                        toggleSelected(m.id)
                      }}
                    >
                      <td className="card-checkbox-cell" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="bulk-checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleSelected(m.id)}
                          aria-label={`Selecionar ${m.equipment?.name || m.id}`}
                        />
                      </td>
                      <td data-label="Equipamento">
                        <strong>{m.equipment?.name || '—'}</strong>
                        {m.isBatch && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(99,102,241,.12)', color: '#6366f1', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }} title="Movimentado em lote">
                            LOTE
                          </span>
                        )}
                        {m.is_edited && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(245,158,11,.15)', color: '#d97706', padding: '1px 5px', borderRadius: 10, fontWeight: 600 }}>
                            editado
                          </span>
                        )}
                      </td>
                      <td data-label="PAT / Série" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {m.serial_number && <div>Série: {m.serial_number}</div>}
                        {m.asset_number && <div>PAT: {formatAssetNumber(m.asset_number)}</div>}
                        {!m.serial_number && !m.asset_number && '—'}
                      </td>
                      <td data-label="Origem" style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} style={{ flexShrink: 0 }} />
                          {m.origin?.name || '—'}
                        </span>
                      </td>
                      <td data-label="Destino">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-color)' }}>
                          <MapPin size={11} style={{ flexShrink: 0 }} />
                          {m.destination?.name || '—'}
                        </span>
                      </td>
                      <td data-label="Responsável" style={{ color: 'var(--text-secondary)' }}>{m.profiles?.full_name || '—'}</td>
                      <td data-label="Recebedor" style={{ color: 'var(--text-secondary)' }}>{m.received_by || '—'}</td>
                      <td data-label="Data / Hora" style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(m.moved_at)}
                      </td>
                      <td data-label="Última edição" style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {m.edited_at ? fmtDateTime(m.edited_at) : '—'}
                      </td>
                      <td data-label="Último Editor" style={{ color: 'var(--text-secondary)' }}>{m.editedBy?.full_name || '—'}</td>
                      <td className="card-actions-cell">
                        <div className="table-actions">
                          {canEditMovements && (
                            <button className="btn-table-action edit" onClick={() => setEditMov(m)}>
                              <Pencil size={13} />
                            </button>
                          )}
                          {m.is_edited && (
                            <button
                              className="btn-table-action"
                              title="Ver histórico de edições"
                              style={{ color: '#d97706' }}
                              onClick={() => setEditInfoMovId(m.id)}
                            >
                              <History size={13} />
                            </button>
                          )}
                          {isAdmin && (
                            <button className="btn-table-action delete" onClick={() => deleteMov(m.id)}>
                              <Trash2 size={13} />
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
        </>
      )}

      {scanResult && (
        <ScanResultModal
          movement={scanResult.mov}
          assetNumber={scanResult.assetNumber}
          onClose={() => setScanResult(null)}
          onRegistrar={onScanRegist}
        />
      )}

      {createOpen && (
        <CreateModal
          equipment={equipment}
          rooms={rooms}
          profilesList={profilesList}
          user={user}
          prefill={createPrefill}
          audit={audit}
          onClose={() => { setCreateOpen(false); setCreatePrefill(null) }}
          onSaved={() => {
            setCreateOpen(false)
            setCreatePrefill(null)
            setPage(1)
            fetchPage(1, filters, search)
          }}
        />
      )}

      {loteOpen && (
        <LoteModal
          equipment={equipment}
          rooms={rooms}
          profilesList={profilesList}
          loteItems={loteItems}
          setLoteItems={setLoteItems}
          loteUid={loteUid}
          setLoteUid={setLoteUid}
          destId={loteDestId}
          setDestId={setLoteDestId}
          destName={loteDestName}
          setDestName={setLoteDestName}
          receivedBy={loteReceivedBy}
          setReceivedBy={setLoteReceivedBy}
          receivedByProfileId={loteReceivedByProfileId}
          setReceivedByProfileId={setLoteReceivedByProfileId}
          itemStatus={loteItemStatus}
          setItemStatus={setLoteItemStatus}
          comentario={loteComentario}
          setComentario={setLoteComentario}
          busy={loteBusy}
          onScan={openScanLote}
          onSubmit={submitLote}
          onClose={closeLote}
        />
      )}

      {editMov && canEditMovements && (
        <EditModal
          mov={editMov}
          equipment={equipment}
          rooms={rooms}
          profilesList={profilesList}
          user={user}
          audit={audit}
          onClose={() => setEditMov(null)}
          onSaved={() => {
            setEditMov(null)
            refresh()
          }}
        />
      )}

      {editInfoMovId && (
        <EditInfoModal movId={editInfoMovId} onClose={() => setEditInfoMovId(null)} />
      )}

      {importRows && (
        <ImportPreviewModal
          rows={importRows}
          onClose={() => setImportRows(null)}
          onConfirm={confirmImport}
        />
      )}

      <Scanner
        open={scannerOpen}
        mode={scanMode}
        onClose={() => setScannerOpen(false)}
        onMaquinaLocalizada={onMaquinaLocalizada}
        onSemHistorico={onSemHistorico}
        onLoteItem={onLoteItem}
        onConcluirLote={onConcluirLote}
        loteCount={loteItems.length}
        loteRecentList={loteItems.slice(-5).reverse()}
      />
    </>
  )
}
