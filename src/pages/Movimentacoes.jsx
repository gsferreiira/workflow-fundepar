import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  Plus,
  X,
  Loader2,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Upload,
  ScanLine,
  MapPin,
  History,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { Pagination } from '../components/Pagination.jsx'
import { Autocomplete } from '../components/Autocomplete.jsx'
import { Scanner, ScanResultModal } from '../components/Scanner.jsx'
import { formatAssetNumber, applyAssetMask, fmtDate, fmtDateTime } from '../utils/format.js'

const PAGE_SIZE = 25

function buildQuery(filters, { page, count = false }) {
  let q = supabase
    .from('asset_movements')
    .select('*, equipment(name)', count ? { count: 'exact' } : {})
    .is('deleted_at', null)
  if (filters.dateFrom)
    q = q.gte('moved_at', new Date(filters.dateFrom + 'T00:00:00').toISOString())
  if (filters.dateTo)
    q = q.lte('moved_at', new Date(filters.dateTo + 'T23:59:59').toISOString())
  if (filters.equipmentId) q = q.eq('equipment_id', filters.equipmentId)
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
  const from = (page - 1) * PAGE_SIZE
  return q.range(from, from + PAGE_SIZE - 1)
}

export function Movimentacoes() {
  const { search } = useOutletContext()
  const { user } = useAuth()
  const { rooms: roomsFetcher, equipment: equipmentFetcher, profiles: profilesFetcher, invalidate } =
    useStore()
  const { showToast, confirm } = useToast()
  const audit = useAudit()
  const isAdmin = user?.role === 'admin'

  const [list, setList] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [equipment, setEquipment] = useState([])
  const [rooms, setRooms] = useState([])
  const [profilesList, setProfilesList] = useState([])

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    equipmentId: '',
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

  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanMode, setScanMode] = useState('single')
  const [scanResult, setScanResult] = useState(null)
  const [createPrefill, setCreatePrefill] = useState(null)

  const [loteItems, setLoteItems] = useState([])
  const [loteUid, setLoteUid] = useState(0)
  const [loteOriginId, setLoteOriginId] = useState('')
  const [loteOriginName, setLoteOriginName] = useState('')
  const [loteDestId, setLoteDestId] = useState('')
  const [loteDestName, setLoteDestName] = useState('')
  const [loteReceivedBy, setLoteReceivedBy] = useState('')
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
      const { data, count, error } = await buildQuery(f, { page: p, count: true })
      if (error) {
        showToast('Erro ao carregar movimentações: ' + error.message, 'danger')
        setList([])
        return
      }
      const [rm, pr] = await Promise.all([roomsFetcher(), profilesFetcher()])
      const roomMap = Object.fromEntries(rm.map((r) => [r.id, r]))
      const profileMap = Object.fromEntries(pr.map((p2) => [p2.id, p2]))
      setList(
        (data || []).map((m) => ({
          ...m,
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

  useEffect(() => {
    setPage(1)
    fetchPage(1, filters, search)
  }, [search])

  useEffect(() => {
    fetchPage(page, filters, search)
  }, [])

  const applyFilters = () => {
    setPage(1)
    fetchPage(1, filters, search)
  }

  const clearFilters = () => {
    const cleared = {
      dateFrom: '',
      dateTo: '',
      equipmentId: '',
      originId: '',
      destId: '',
      responsible: '',
      assetDigits: '',
    }
    setFilters(cleared)
    setPage(1)
    fetchPage(1, cleared, search)
  }

  const refresh = () => fetchPage(page, filters, search)

  const onPrev = () => {
    const p = page - 1
    setPage(p)
    fetchPage(p, filters, search)
    window.scrollTo(0, 0)
  }

  const onNext = () => {
    const p = page + 1
    setPage(p)
    fetchPage(p, filters, search)
    window.scrollTo(0, 0)
  }

  const deleteMov = async (id) => {
    const ok = await confirm({
      title: 'Excluir movimentação',
      message:
        'Tem certeza que deseja excluir esta movimentação? O registro será marcado como excluído.',
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase
      .from('asset_movements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) {
      showToast('Erro ao excluir: ' + error.message, 'danger')
      return
    }
    audit.deleted('asset_movements', id)
    showToast('Movimentação excluída.', 'success')
    refresh()
  }

  const exportExcel = async () => {
    showToast('Preparando exportação...', 'success')
    const f = { ...filters, search: search || '' }
    const XLSX = (await import('xlsx')).default
    const [rm, pr] = await Promise.all([roomsFetcher(), profilesFetcher()])
    const roomMap = Object.fromEntries(rm.map((r) => [r.id, r]))
    const profileMap = Object.fromEntries(pr.map((p2) => [p2.id, p2]))
    let all = []
    let p2 = 1
    const BATCH = 1000
    while (true) {
      const { data, error } = await buildQuery(f, { page: p2, count: false })
      if (error) {
        showToast('Erro ao exportar: ' + error.message, 'danger')
        return
      }
      all = all.concat(data || [])
      if (!data || data.length < BATCH) break
      p2++
      if (all.length >= 20000) break
    }
    if (all.length === 0) {
      showToast('Nenhuma movimentação para exportar.', 'warning')
      return
    }
    const wsData = [
      ['Equipamento', 'Nº Série', 'Nº Patrimônio', 'Origem', 'Destino', 'Responsável', 'Com quem está', 'Data / Hora'],
      ...all.map((m) => [
        m.equipment?.name || '—',
        m.serial_number || '—',
        formatAssetNumber(m.asset_number) || '—',
        roomMap[m.origin_room_id]?.name || '—',
        roomMap[m.destination_room_id]?.name || '—',
        profileMap[m.moved_by]?.full_name || '—',
        m.received_by || '—',
        new Date(m.moved_at).toLocaleString('pt-BR'),
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [
      { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
      { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 20 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Movimentações')
    XLSX.writeFile(wb, `movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`)
    showToast(`${all.length} linha${all.length !== 1 ? 's' : ''} exportada${all.length !== 1 ? 's' : ''}!`, 'success')
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
    const XLSX = (await import('xlsx')).default
    const normalize = (s) => (s || '').toString().trim().toLowerCase()
    const [eq, rm] = await Promise.all([equipmentFetcher(), roomsFetcher()])
    const eqByName = Object.fromEntries(eq.map((e2) => [normalize(e2.name), e2]))
    const roomByName = Object.fromEntries(rm.map((r) => [normalize(r.name), r]))

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })

    const parseDate = (val) => {
      if (!val) return null
      if (val instanceof Date) return val
      const s = val.toString().trim()
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
      if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0))
      const d = new Date(s)
      return isNaN(d) ? null : d
    }

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

  const openScanSingle = () => {
    setScanMode('single')
    setScanResult(null)
    setScannerOpen(true)
  }

  const onMaquinaLocalizada = (mov, assetNumber) => {
    setScannerOpen(false)
    setScanResult({ mov, assetNumber })
  }

  const onSemHistorico = (assetNumber) => {
    setScannerOpen(false)
    setCreatePrefill({ asset: assetNumber, originId: '', originName: '' })
    setCreateOpen(true)
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
    if (!loteOriginId) { showToast('Selecione a sala de origem.', 'warning'); return }
    if (!loteDestId) { showToast('Selecione a sala de destino.', 'warning'); return }
    if (loteOriginId === loteDestId) { showToast('Origem e destino não podem ser iguais.', 'warning'); return }
    if (loteItems.length === 0) { showToast('Adicione ao menos um equipamento.', 'warning'); return }
    if (loteItems.some((i) => !i.equipmentId)) {
      showToast('Preencha ou remova os itens sem equipamento selecionado.', 'warning')
      return
    }
    setLoteBusy(true)
    const movedAt = new Date().toISOString()
    const inserts = loteItems.map((item) => {
      const digits = (item.assetNumber || '').replace(/\D/g, '')
      const assetNumber =
        digits.length === 12
          ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
          : item.assetNumber || null
      return {
        equipment_id: item.equipmentId,
        serial_number: item.serialNumber || null,
        asset_number: assetNumber,
        origin_room_id: loteOriginId,
        destination_room_id: loteDestId,
        moved_by: user.id,
        received_by: loteReceivedBy || null,
        moved_at: movedAt,
        item_status: loteItemStatus || null,
        comentario: loteComentario || null,
      }
    })
    const { error } = await supabase.from('asset_movements').insert(inserts)
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
        moved_by: user.id,
        received_by: loteReceivedBy || null,
        moved_at: movedAt,
      }))
    if (locUpserts.length > 0) {
      await supabase
        .from('equipment_locations')
        .upsert(locUpserts, { onConflict: 'asset_number' })
    }
    if (loteItemStatus) {
      const uniqueEqIds = [...new Set(loteItems.map((i) => i.equipmentId))]
      for (const eqId of uniqueEqIds) {
        await supabase.from('equipment').update({ status: loteItemStatus }).eq('id', eqId)
      }
    }
    audit.log('batch_movement', 'asset_movements', null, {
      count: inserts.length,
      from: loteOriginName,
      to: loteDestName,
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
    setLoteItemStatus('')
    setLoteComentario('')
    setLoteBusy(false)
  }

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Movimentações</h2>
          <p>Histórico de todas as movimentações de patrimônio.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ background: '#059669' }} onClick={exportExcel}>
            <FileSpreadsheet size={14} /> Exportar
          </button>
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
          <button className="btn-primary" style={{ background: 'var(--warning-color)' }} onClick={openScanSingle}>
            <ScanLine size={14} /> Scanner
          </button>
          <button className="btn-primary" onClick={() => setLoteOpen(true)}>
            <Plus size={14} /> Movimentação em Lote
          </button>
          <button className="btn-primary" onClick={() => { setCreatePrefill(null); setCreateOpen(true) }}>
            <Plus size={14} /> Nova Movimentação
          </button>
        </div>
      </div>

      <div className="filter-bar fade-in">
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

      {!list ? (
        <SkeletonTable />
      ) : (
        <>
          <div className="table-card fade-in">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Nº Série / Patrimônio</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Responsável</th>
                  <th>Com quem está</th>
                  <th>Data / Hora</th>
                  <th style={{ width: 120 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                ) : (
                  list.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.equipment?.name || '—'}</strong>
                        {m.is_edited && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(245,158,11,.15)', color: '#d97706', padding: '1px 5px', borderRadius: 10, fontWeight: 600 }}>
                            editado
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {m.serial_number && <div>Série: {m.serial_number}</div>}
                        {m.asset_number && <div>PAT: {formatAssetNumber(m.asset_number)}</div>}
                        {!m.serial_number && !m.asset_number && '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} style={{ flexShrink: 0 }} />
                          {m.origin?.name || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-color)' }}>
                          <MapPin size={11} style={{ flexShrink: 0 }} />
                          {m.destination?.name || '—'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.profiles?.full_name || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.received_by || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(m.moved_at)}
                      </td>
                      <td>
                        <div className="table-actions">
                          {isAdmin && (
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
          loteItems={loteItems}
          setLoteItems={setLoteItems}
          loteUid={loteUid}
          setLoteUid={setLoteUid}
          originId={loteOriginId}
          setOriginId={setLoteOriginId}
          originName={loteOriginName}
          setOriginName={setLoteOriginName}
          destId={loteDestId}
          setDestId={setLoteDestId}
          destName={loteDestName}
          setDestName={setLoteDestName}
          receivedBy={loteReceivedBy}
          setReceivedBy={setLoteReceivedBy}
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

      {editMov && (
        <EditModal
          mov={editMov}
          rooms={rooms}
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
    </>
  )
}

function CreateModal({ equipment, rooms, user, prefill, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [eqId, setEqId] = useState('')
  const [eqName, setEqName] = useState('')
  const [originId, setOriginId] = useState(prefill?.originId || '')
  const [originName, setOriginName] = useState(prefill?.originName || '')
  const [destId, setDestId] = useState('')
  const [destName, setDestName] = useState('')
  const [serial, setSerial] = useState('')
  const [asset, setAsset] = useState(prefill?.asset || '')
  const [receivedBy, setReceivedBy] = useState('')
  const [itemStatus, setItemStatus] = useState('')
  const [comentario, setComentario] = useState('')

  const lookupOrigin = async (rawAsset) => {
    const digits = rawAsset.replace(/\D/g, '')
    if (digits.length !== 12) return
    if (originId) return
    const assetNumber = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
    const { data } = await supabase
      .from('asset_movements')
      .select('destination_room_id, destination_room:destination_room_id(id, name)')
      .eq('asset_number', assetNumber)
      .is('deleted_at', null)
      .order('moved_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0 && data[0].destination_room) {
      const room = data[0].destination_room
      setOriginId(room.id)
      setOriginName(room.name)
      showToast(`Origem preenchida automaticamente: ${room.name}`, 'success')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!eqId) { showToast('Selecione um equipamento da lista.', 'warning'); return }
    if (!originId) { showToast('Selecione a sala de origem.', 'warning'); return }
    if (!destId) { showToast('Selecione a sala de destino.', 'warning'); return }

    const digits = asset.replace(/\D/g, '')
    const assetNumber =
      digits.length === 12
        ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
        : asset || null

    if (originId === destId) {
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
        serial_number: serial || null,
        asset_number: assetNumber,
        origin_room_id: originId,
        destination_room_id: destId,
        moved_by: user.id,
        received_by: receivedBy || null,
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
      await supabase.from('equipment').update({ status: itemStatus }).eq('id', eqId)
    }
    if (assetNumber) {
      await supabase.from('equipment_locations').upsert(
        { equipment_id: eqId, asset_number: assetNumber, serial_number: serial || null, current_room_id: destId, moved_by: user.id, received_by: receivedBy || null, moved_at: movedAt },
        { onConflict: 'asset_number' },
      )
    }
    audit.created('asset_movements', inserted?.id, { equipment_id: eqId, asset_number: assetNumber, from: originName, to: destName })
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
            <label>Equipamento <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <Autocomplete items={equipment} value={eqId} label={eqName}
              onChange={(id, name) => { setEqId(id); setEqName(name || '') }}
              placeholder="Buscar equipamento..." required />
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Origem <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <Autocomplete items={rooms} value={originId} label={originName}
                onChange={(id, name) => { setOriginId(id); setOriginName(name || '') }}
                placeholder="Sala de origem..." required />
            </div>
            <div className="form-group">
              <label>Destino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <Autocomplete items={rooms} value={destId} label={destName}
                onChange={(id, name) => { setDestId(id); setDestName(name || '') }}
                placeholder="Sala de destino..." required />
            </div>
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Nº Série</label>
              <input type="text" className="form-control" value={serial}
                onChange={(e) => setSerial(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="form-group">
              <label>Nº Patrimônio</label>
              <input type="text" className="form-control" value={asset}
                onChange={(e) => { setAsset(applyAssetMask(e.target.value)); lookupOrigin(e.target.value) }}
                placeholder="000.000.000.000" />
            </div>
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Recebedor</label>
              <input type="text" className="form-control" value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)} placeholder="Nome de quem recebeu" />
            </div>
            <div className="form-group">
              <label>Status do item</label>
              <select className="form-control" value={itemStatus}
                onChange={(e) => setItemStatus(e.target.value)}>
                <option value="">Não alterar</option>
                <option value="novo">Novo</option>
                <option value="bom">Bom</option>
                <option value="regular">Regular</option>
                <option value="inservível">Inservível</option>
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
    </div>
  )
}

function LoteModal({
  equipment, rooms, loteItems, setLoteItems, loteUid, setLoteUid,
  originId, setOriginId, originName, setOriginName,
  destId, setDestId, destName, setDestName,
  receivedBy, setReceivedBy, itemStatus, setItemStatus,
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
          <div className="form-2col">
            <div className="form-group">
              <label>Origem <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <Autocomplete items={rooms} value={originId} label={originName}
                onChange={(id, name) => { setOriginId(id); setOriginName(name || '') }}
                placeholder="Sala de origem..." />
            </div>
            <div className="form-group">
              <label>Destino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <Autocomplete items={rooms} value={destId} label={destName}
                onChange={(id, name) => { setDestId(id); setDestName(name || '') }}
                placeholder="Sala de destino..." />
            </div>
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Recebedor</label>
              <input type="text" className="form-control" value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)} placeholder="Nome de quem recebeu" />
            </div>
            <div className="form-group">
              <label>Status dos itens</label>
              <select className="form-control" value={itemStatus} onChange={(e) => setItemStatus(e.target.value)}>
                <option value="">Não alterar</option>
                <option value="novo">Novo</option>
                <option value="bom">Bom</option>
                <option value="regular">Regular</option>
                <option value="inservível">Inservível</option>
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
              <strong style={{ fontSize: 13 }}>Equipamentos</strong>
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
                  Use o botão "Adicionar" ou o scanner para incluir equipamentos.
                </div>
              ) : (
                loteItems.map((item) => (
                  <div key={item.uid} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 2, minWidth: 0 }}>
                      <Autocomplete
                        items={equipment}
                        value={item.equipmentId}
                        label={item.equipmentName}
                        onChange={(id, name) => { updateItem(item.uid, 'equipmentId', id); updateItem(item.uid, 'equipmentName', name || '') }}
                        placeholder="Equipamento *"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input type="text" className="form-control" value={item.assetNumber}
                        onChange={(e) => updateItem(item.uid, 'assetNumber', applyAssetMask(e.target.value))}
                        placeholder="Nº Patrimônio" />
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

function EditModal({ mov, rooms, user, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [originId, setOriginId] = useState(mov.origin_room_id || '')
  const [originName, setOriginName] = useState(mov.origin?.name || '')
  const [destId, setDestId] = useState(mov.destination_room_id || '')
  const [destName, setDestName] = useState(mov.destination?.name || '')
  const [serial, setSerial] = useState(mov.serial_number || '')
  const [asset, setAsset] = useState(formatAssetNumber(mov.asset_number) || '')
  const [receivedBy, setReceivedBy] = useState(mov.received_by || '')
  const [movedAt, setMovedAt] = useState(
    mov.moved_at ? new Date(mov.moved_at).toISOString().slice(0, 16) : '',
  )
  const [editReason, setEditReason] = useState('')

  const submit = async (e) => {
    e.preventDefault()
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
        serial_number: serial || null,
        asset_number: assetNumber,
        origin_room_id: originId,
        destination_room_id: destId,
        received_by: receivedBy || null,
        moved_at: movedAt ? new Date(movedAt).toISOString() : undefined,
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
          <div className="form-2col">
            <div className="form-group">
              <label>Origem <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <Autocomplete items={rooms} value={originId} label={originName}
                onChange={(id, name) => { setOriginId(id); setOriginName(name || '') }}
                placeholder="Sala de origem..." />
            </div>
            <div className="form-group">
              <label>Destino <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <Autocomplete items={rooms} value={destId} label={destName}
                onChange={(id, name) => { setDestId(id); setDestName(name || '') }}
                placeholder="Sala de destino..." />
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
              <input type="text" className="form-control" value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Data / Hora</label>
              <input type="datetime-local" className="form-control" value={movedAt}
                onChange={(e) => setMovedAt(e.target.value)} />
            </div>
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

function EditInfoModal({ movId, onClose }) {
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

function ImportPreviewModal({ rows, onClose, onConfirm }) {
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
