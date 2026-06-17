import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, ArrowRight, AlertCircle, Search, Download } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { formatAssetNumber, fmtDateTime, fmtDate } from '../utils/format.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { Pagination } from '../components/Pagination.jsx'

const PAGE_SIZE = 25

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}

const MONTH_OPTIONS = getMonthOptions()

async function exportMovimentacoes(rows, room, sigla) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Fundepar TI'
  const ws = wb.addWorksheet(`Movimentações ${sigla?.toUpperCase()}`)

  const titleRow = ws.addRow([`Movimentações — ${room?.name || sigla?.toUpperCase()}`])
  titleRow.font = { bold: true, size: 13 }
  ws.mergeCells('A1:G1')
  ws.addRow([])

  const hRow = ws.addRow(['Equipamento', 'Nº Patrimônio', 'Tipo', 'Origem', 'Destino', 'Movido por (TI)', 'Recebido por', 'Data / Hora'])
  hRow.font = { bold: true }
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F0FB' } }
  ws.getColumn(1).width = 30; ws.getColumn(2).width = 16; ws.getColumn(3).width = 10
  ws.getColumn(4).width = 20; ws.getColumn(5).width = 20; ws.getColumn(6).width = 22
  ws.getColumn(7).width = 22; ws.getColumn(8).width = 18

  for (const m of rows) {
    const isEntrada = m.destination?.id === room?.id
    ws.addRow([
      m.equipment?.name || '—',
      m.asset_number ? formatAssetNumber(m.asset_number) : '—',
      isEntrada ? 'Entrada' : 'Saída',
      m.origin?.name || '—',
      m.destination?.name || '—',
      m.moved_by_profile?.full_name || '—',
      m.received_by || '—',
      m.moved_at ? fmtDateTime(m.moved_at) : '—',
    ])
  }

  ws.addRow([])
  ws.addRow([`Gerado em ${new Date().toLocaleString('pt-BR')}`])

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `movimentacoes-${sigla?.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

async function enrichRows(rows, roomId) {
  if (!rows.length) return []
  const eqIds      = [...new Set(rows.map((r) => r.equipment_id).filter(Boolean))]
  const roomIds    = [...new Set([...rows.map((r) => r.origin_room_id), ...rows.map((r) => r.destination_room_id)].filter(Boolean))]
  const profileIds = [...new Set(rows.map((r) => r.moved_by).filter(Boolean))]

  const [eqRes, roomRes, profileRes] = await Promise.all([
    eqIds.length      ? supabase.from('equipment').select('id, name, categoria').in('id', eqIds)  : { data: [] },
    roomIds.length    ? supabase.from('rooms').select('id, name, sigla').in('id', roomIds)         : { data: [] },
    profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds)     : { data: [] },
  ])

  const eqMap      = Object.fromEntries((eqRes.data      || []).map((x) => [x.id, x]))
  const roomMap    = Object.fromEntries((roomRes.data    || []).map((x) => [x.id, x]))
  const profileMap = Object.fromEntries((profileRes.data || []).map((x) => [x.id, x]))

  return rows.map((r) => ({
    ...r,
    equipment:        eqMap[r.equipment_id]           || null,
    origin:           roomMap[r.origin_room_id]        || null,
    destination:      roomMap[r.destination_room_id]   || null,
    moved_by_profile: profileMap[r.moved_by]           || null,
  }))
}

export function MovimentacoesSetor() {
  const { sigla } = useParams()
  const { user }  = useAuth()
  const room      = user?.coordinator_room

  const [list, setList]             = useState(null)
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loadError, setLoadError]   = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [search, setSearch]         = useState('')
  const [searchQ, setSearchQ]       = useState('')   // debounced value sent to DB
  const [exporting, setExporting]   = useState(false)
  const debounceRef                 = useRef(null)

  const onSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setSearchQ(val); setPage(1) }, 400)
  }

  const load = useCallback(async (p = 1) => {
    if (!room?.id) return
    setList(null)
    setLoadError(null)

    const from = (p - 1) * PAGE_SIZE

    const buildBase = () => {
      let q = supabase.from('asset_movements').is('deleted_at', null)

      if (typeFilter === 'entrada')      q = q.eq('destination_room_id', room.id)
      else if (typeFilter === 'saida')   q = q.eq('origin_room_id', room.id)
      else q = q.or(`origin_room_id.eq.${room.id},destination_room_id.eq.${room.id}`)

      if (monthFilter) {
        const [y, m] = monthFilter.split('-').map(Number)
        q = q.gte('moved_at', new Date(y, m - 1, 1).toISOString()).lt('moved_at', new Date(y, m, 1).toISOString())
      }

      if (searchQ.trim()) {
        q = q.ilike('received_by', `%${searchQ.trim()}%`)
      }

      return q
    }

    const [countRes, dataRes] = await Promise.all([
      buildBase().select('id', { count: 'exact', head: true }),
      buildBase()
        .select('id, asset_number, serial_number, moved_at, received_by, equipment_id, moved_by, origin_room_id, destination_room_id')
        .order('moved_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
    ])

    if (dataRes.error) { setLoadError(dataRes.error.message); setList([]); return }
    const rows = dataRes.data || []
    if (rows.length === 0) { setTotal(0); setList([]); return }

    const enriched = await enrichRows(rows, room.id).catch((err) => { setLoadError(err.message); setList([]); return null })
    if (!enriched) return

    setTotal(countRes.count || 0)
    setList(enriched)
  }, [room?.id, typeFilter, monthFilter, searchQ])

  useEffect(() => { load(1) }, [load])

  const onTypeFilter = (tipo) => { setTypeFilter(tipo); setPage(1) }
  const onMonthFilter = (mes) => { setMonthFilter(mes); setPage(1) }
  const onPrev = () => { const p = page - 1; setPage(p); load(p); window.scrollTo(0, 0) }
  const onNext = () => { const p = page + 1; setPage(p); load(p); window.scrollTo(0, 0) }

  // Client-side filter for asset_number / equipment name not covered by server search
  const filteredList = useMemo(() => {
    if (!list || !searchQ.trim()) return list
    const q = searchQ.toLowerCase().trim()
    return list.filter((m) =>
      (m.asset_number?.toString() || '').includes(q) ||
      (m.serial_number || '').toLowerCase().includes(q) ||
      (m.equipment?.name || '').toLowerCase().includes(q) ||
      (m.received_by || '').toLowerCase().includes(q),
    )
  }, [list, searchQ])

  const handleExport = async () => {
    if (!list || list.length === 0) return
    setExporting(true)
    try { await exportMovimentacoes(filteredList || list, room, sigla) }
    catch (e) { console.error(e) }
    finally { setExporting(false) }
  }

  if (!room) return <SkeletonTable />

  if (loadError) return (
    <div style={{ margin: '40px 0', padding: '20px 24px', borderRadius: 12, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong style={{ color: '#dc2626' }}>Erro ao carregar movimentações</strong>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{loadError}</p>
      </div>
    </div>
  )

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Movimentações — {sigla?.toUpperCase()}</h2>
          <p>Histórico de entradas e saídas de equipamentos do setor.</p>
        </div>
        {list && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {total} movimentaç{total !== 1 ? 'ões' : 'ão'}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={exporting || !list || list.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Download size={14} /> {exporting ? 'Exportando…' : 'Excel'}
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all',     label: 'Todas' },
            { key: 'entrada', label: 'Entradas' },
            { key: 'saida',   label: 'Saídas' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTypeFilter(key)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${typeFilter === key ? '#6366f1' : 'var(--border-color)'}`,
                background: typeFilter === key ? 'rgba(99,102,241,.1)' : 'transparent',
                color: typeFilter === key ? '#6366f1' : 'var(--text-secondary)',
                transition: 'all .15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <select className="form-control" value={monthFilter} onChange={(e) => onMonthFilter(e.target.value)} style={{ fontSize: 13, padding: '6px 10px', maxWidth: 200 }}>
          <option value="">Todos os meses</option>
          {MONTH_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por responsável, patrimônio ou equipamento…"
            value={search}
            onChange={onSearchChange}
            style={{ fontSize: 13, paddingLeft: 30 }}
          />
        </div>
      </div>

      {!list ? (
        <SkeletonTable />
      ) : (filteredList?.length || 0) === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <p>{searchQ ? `Nenhum resultado para "${searchQ}".` : 'Nenhuma movimentação encontrada com os filtros selecionados.'}</p>
        </div>
      ) : (
        <>
          <div className="table-card fade-in">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Nº Patrimônio</th>
                  <th>Tipo</th>
                  <th>Origem → Destino</th>
                  <th>Movido por (TI)</th>
                  <th>Recebido por</th>
                  <th>Data / Hora</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((m) => {
                  const isEntrada = m.destination?.id === room.id
                  return (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.equipment?.name || '—'}</strong>
                        {m.equipment?.categoria && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {m.equipment.categoria}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {m.asset_number ? formatAssetNumber(m.asset_number) : '—'}
                        {m.serial_number && <div style={{ fontSize: 11, marginTop: 2 }}>{m.serial_number}</div>}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: isEntrada ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.1)',
                          color: isEntrada ? '#059669' : '#dc2626',
                        }}>
                          {isEntrada ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}>
                            <MapPin size={11} />{m.origin?.sigla || m.origin?.name || '—'}
                          </span>
                          <ArrowRight size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: isEntrada ? '#059669' : '#dc2626', fontWeight: 600 }}>
                            <MapPin size={11} />{m.destination?.sigla || m.destination?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.moved_by_profile?.full_name || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.received_by || <span style={{ fontStyle: 'italic' }}>—</span>}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(m.moved_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPrev={onPrev} onNext={onNext} />
        </>
      )}
    </>
  )
}
