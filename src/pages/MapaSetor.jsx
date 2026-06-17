import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Package, User, Monitor, Cpu, Printer, Keyboard, HardDrive,
  AlertCircle, Search, Download, AlertTriangle,
  ChevronUp, ChevronDown, MessageSquareWarning, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { supabase } from '../lib/supabase.js'
import { formatAssetNumber, fmtDate } from '../utils/format.js'
import { SkeletonTable } from '../components/Skeleton.jsx'

const STATUS_CFG = {
  'novo':        { label: 'Novo',        color: '#059669', bg: 'rgba(16,185,129,.12)' },
  'bom':         { label: 'Bom',         color: '#2563eb', bg: 'rgba(59,130,246,.12)' },
  'regular':     { label: 'Regular',     color: '#d97706', bg: 'rgba(245,158,11,.12)' },
  'inservível':  { label: 'Inservível',  color: '#64748b', bg: 'rgba(100,116,139,.12)' },
  'com defeito': { label: 'Com Defeito', color: '#dc2626', bg: 'rgba(239,68,68,.12)' },
}
const STATUS_PROBLEMA = new Set(['inservível', 'com defeito'])

const CATEGORIA_ICON = {
  'notebook':    Monitor,
  'computador':  Cpu,
  'monitor':     Monitor,
  'impressora':  Printer,
  'teclado':     Keyboard,
  'hd externo':  HardDrive,
}

function categoriaIcon(cat) {
  if (!cat) return Package
  const key = cat.toLowerCase()
  for (const [k, Icon] of Object.entries(CATEGORIA_ICON)) {
    if (key.includes(k)) return Icon
  }
  return Package
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status]
  if (!cfg) return <span style={{ color: 'var(--text-secondary)' }}>—</span>
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
      {cfg.label}
    </span>
  )
}

async function exportInventario(groups, room, sigla) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Fundepar TI'
  const ws = wb.addWorksheet(`Inventário ${sigla?.toUpperCase()}`)

  const titleRow = ws.addRow([`Inventário — ${room?.name || sigla?.toUpperCase()}`])
  titleRow.font = { bold: true, size: 13 }
  ws.mergeCells('A1:G1')
  ws.addRow([])

  const hRow = ws.addRow(['Responsável', 'Equipamento', 'Categoria', 'Nº Patrimônio', 'Nº Série', 'Status', 'Última Mov.'])
  hRow.font = { bold: true }
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F0FB' } }

  ws.getColumn(1).width = 28; ws.getColumn(2).width = 32; ws.getColumn(3).width = 18
  ws.getColumn(4).width = 16; ws.getColumn(5).width = 20; ws.getColumn(6).width = 14
  ws.getColumn(7).width = 14

  for (const group of groups) {
    for (const item of group.items) {
      const row = ws.addRow([
        group.name || 'Sem responsável',
        item.equipment?.name || '—',
        item.equipment?.categoria || '—',
        item.asset_number ? formatAssetNumber(item.asset_number) : '—',
        item.serial_number || '—',
        STATUS_CFG[item.equipment?.status]?.label || (item.equipment?.status || '—'),
        item.moved_at ? fmtDate(item.moved_at) : '—',
      ])
      if (STATUS_PROBLEMA.has(item.equipment?.status)) {
        row.getCell(6).font = { color: { argb: 'FFDC2626' }, bold: true }
      }
    }
  }

  ws.addRow([])
  ws.addRow([`Gerado em ${new Date().toLocaleString('pt-BR')}`])

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `inventario-${sigla?.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Modal de reporte ao TI ───────────────────────────────────────────────────

function ReportModal({ item, room, user, onClose }) {
  const { showToast } = useToast()
  const [msg, setMsg]       = useState('')
  const [saving, setSaving] = useState(false)

  const equipName = item.equipment?.name || '—'
  const asset     = item.asset_number ? formatAssetNumber(item.asset_number) : null
  const statusLbl = STATUS_CFG[item.equipment?.status]?.label || (item.equipment?.status || '')

  const handleSend = async () => {
    setSaving(true)
    const title = `Problema de equipamento: ${equipName}${asset ? ` (Pat. ${asset})` : ''}`
    const description = [
      `Sala: ${room?.name || '—'}`,
      `Status: ${statusLbl}`,
      msg.trim() ? `\nDescrição: ${msg.trim()}` : '',
    ].filter(Boolean).join('\n')

    const { error } = await supabase.from('tickets').insert({
      title,
      description,
      room_id:      room?.id || null,
      requester_id: user?.id || null,
      status:       'aberto',
    })

    setSaving(false)
    if (error) { showToast('Erro ao abrir chamado: ' + error.message, 'danger'); return }
    showToast('Chamado aberto! O técnico será notificado.', 'success')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h3>Reportar problema ao TI</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {equipName}{asset ? ` · Pat. ${asset}` : ''}
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.55 }}>
          Um chamado será aberto com os dados deste equipamento. Descreva o problema para ajudar o técnico:
        </div>
        <div className="form-group">
          <label>Descrição do problema (opcional)</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Ex: tela apagou, teclado não liga, barulho incomum..."
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={saving}>
            {saving ? 'Enviando…' : 'Abrir chamado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MapaSetor ────────────────────────────────────────────────────────────────

export function MapaSetor() {
  const { sigla }  = useParams()
  const { user }   = useAuth()
  const room       = user?.coordinator_room

  const [items, setItems]           = useState(null)
  const [loadError, setLoadError]   = useState(null)
  const [search, setSearch]         = useState('')
  const [sortKey, setSortKey]       = useState(null)
  const [sortDir, setSortDir]       = useState('asc')
  const [exporting, setExporting]   = useState(false)
  const [reportItem, setReportItem] = useState(null)

  const load = useCallback(async () => {
    if (!room?.id) return
    setLoadError(null)
    setItems(null)

    const { data: locs, error: locError } = await supabase
      .from('equipment_locations')
      .select('asset_number, serial_number, received_by, moved_at, equipment_id, current_room_id')
      .eq('current_room_id', room.id)

    if (locError) { setLoadError(locError.message); setItems([]); return }
    if (!locs || locs.length === 0) { setItems([]); return }

    const eqIds        = [...new Set(locs.map((l) => l.equipment_id).filter(Boolean))]
    const assetNumbers = locs.map((l) => l.asset_number).filter(Boolean)

    const secondary = await Promise.all([
      eqIds.length > 0
        ? supabase.from('equipment').select('id, name, categoria, status').in('id', eqIds)
        : { data: [] },
      assetNumbers.length > 0
        ? supabase.from('asset_movements').select('asset_number, received_by, moved_at')
            .eq('destination_room_id', room.id).in('asset_number', assetNumbers)
            .is('deleted_at', null).order('moved_at', { ascending: false })
        : { data: [] },
    ]).catch((err) => { setLoadError(err.message); setItems([]); return null })
    if (!secondary) return
    const [eqRes, movRes] = secondary

    const eqMap = Object.fromEntries((eqRes.data || []).map((e) => [e.id, e]))
    const receivedByMap = {}
    for (const mov of (movRes.data || [])) {
      if (!(mov.asset_number in receivedByMap)) receivedByMap[mov.asset_number] = mov.received_by || null
    }

    setItems(locs.map((loc) => ({
      ...loc,
      equipment:   eqMap[loc.equipment_id] || null,
      received_by: loc.received_by || receivedByMap[loc.asset_number] || null,
    })))
  }, [room?.id])

  useEffect(() => { load() }, [load])

  const onSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else { setSortDir('asc') }
      return key
    })
  }, [])

  const groups = useMemo(() => {
    if (!items) return []
    const map = new Map()
    for (const item of items) {
      const name = item.received_by || null
      const key  = name || '__none__'
      if (!map.has(key)) map.set(key, { key, name, items: [] })
      map.get(key).items.push(item)
    }
    return [...map.values()].sort((a, b) => {
      if (!a.name && b.name) return 1
      if (a.name && !b.name) return -1
      return (a.name || '').localeCompare(b.name || '', 'pt-BR')
    })
  }, [items])

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = q
      ? groups
          .map((g) => ({
            ...g,
            items: g.items.filter((item) =>
              (item.equipment?.name || '').toLowerCase().includes(q) ||
              (item.asset_number?.toString() || '').includes(q) ||
              (item.serial_number || '').toLowerCase().includes(q) ||
              (g.name || '').toLowerCase().includes(q),
            ),
          }))
          .filter((g) => g.items.length > 0)
      : groups

    if (sortKey) {
      result = result.map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) => {
          const getValue = (item) =>
            sortKey === 'name'      ? (item.equipment?.name || '')
            : sortKey === 'status'  ? (item.equipment?.status || '')
            : sortKey === 'categoria' ? (item.equipment?.categoria || '')
            : sortKey === 'moved_at' ? (item.moved_at || '')
            : ''
          const cmp = getValue(a).localeCompare(getValue(b), 'pt-BR')
          return sortDir === 'asc' ? cmp : -cmp
        }),
      }))
    }

    return result
  }, [groups, search, sortKey, sortDir])

  const problemCount = useMemo(
    () => (items || []).filter((i) => STATUS_PROBLEMA.has(i.equipment?.status)).length,
    [items],
  )

  const handleExport = async () => {
    setExporting(true)
    try { await exportInventario(filteredGroups.length ? filteredGroups : groups, room, sigla) }
    finally { setExporting(false) }
  }

  if (!room) return <SkeletonTable />

  if (loadError) return (
    <div style={{ margin: '40px 0', padding: '20px 24px', borderRadius: 12, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong style={{ color: '#dc2626' }}>Erro ao carregar equipamentos</strong>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{loadError}</p>
      </div>
    </div>
  )

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Minha Sala — {sigla?.toUpperCase()}</h2>
          <p>{room.name}</p>
        </div>
        {items && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <SummaryChip label="Equipamentos"   value={items.length}                        color="#6366f1" bg="rgba(99,102,241,.08)" />
            <SummaryChip label="Responsáveis"   value={groups.filter((g) => g.name).length} color="#059669" bg="rgba(16,185,129,.08)" />
            {problemCount > 0 && (
              <SummaryChip label="Com problema" value={problemCount} color="#dc2626" bg="rgba(239,68,68,.08)" icon={AlertTriangle} />
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                🖨 Imprimir
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={exporting || items.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Download size={14} /> {exporting ? 'Exportando…' : 'Excel'}
              </button>
            </div>
          </div>
        )}
      </div>

      {items && items.length > 0 && (
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por nome, patrimônio, série ou responsável…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
      )}

      {!items ? (
        <SkeletonTable />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <Package size={48} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15 }}>Nenhum equipamento registrado nesta sala.</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Quando o TI registrar movimentações para este setor, os equipamentos aparecerão aqui.</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          <Search size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
          <p>Nenhum equipamento encontrado para "{search}".</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filteredGroups.map((group) => (
            <PersonCard key={group.key} group={group} sortKey={sortKey} sortDir={sortDir} onSort={onSort} onReport={setReportItem} />
          ))}
        </div>
      )}

      {reportItem && (
        <ReportModal item={reportItem} room={room} user={user} onClose={() => setReportItem(null)} />
      )}
    </>
  )
}

function SummaryChip({ label, value, color, bg, icon: Icon }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '10px 16px', borderLeft: `3px solid ${color}`, minWidth: 110 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={16} />}{value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ opacity: 0.25, fontSize: 10, marginLeft: 3 }}>↕</span>
  return <span style={{ fontSize: 10, marginLeft: 3 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

function ThSortable({ col, label, sortKey, sortDir, onSort }) {
  const active = sortKey === col
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label}<SortIcon active={active} dir={sortDir} />
    </th>
  )
}

function PersonCard({ group, sortKey, sortDir, onSort, onReport }) {
  const initials = group.name
    ? group.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('')
    : '?'

  return (
    <div className="table-card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: group.name ? 'rgba(99,102,241,.03)' : 'rgba(245,158,11,.03)' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: group.name ? 'rgba(99,102,241,.12)' : 'rgba(245,158,11,.12)', color: group.name ? '#6366f1' : '#d97706', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {group.name ? initials : <User size={16} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: group.name ? 'var(--text-main)' : '#d97706' }}>
            {group.name || 'Sem responsável definido'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
            {group.items.length} equipamento{group.items.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <ThSortable col="name"       label="Equipamento"   sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <ThSortable col="categoria"  label="Categoria"     sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <ThSortable col="asset"      label="Nº Patrimônio" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th>Nº Série</th>
            <ThSortable col="status"     label="Status"        sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <ThSortable col="moved_at"   label="Última mov."   sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th style={{ width: 44 }}></th>
          </tr>
        </thead>
        <tbody>
          {group.items.map((item, idx) => {
            const Icon     = categoriaIcon(item.equipment?.categoria)
            const problema = STATUS_PROBLEMA.has(item.equipment?.status)
            return (
              <tr key={item.asset_number || item.equipment_id || idx} style={problema ? { background: 'rgba(239,68,68,.04)' } : undefined}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <strong style={problema ? { color: '#dc2626' } : undefined}>{item.equipment?.name || '—'}</strong>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{item.equipment?.categoria || '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {item.asset_number ? formatAssetNumber(item.asset_number) : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.serial_number || '—'}</td>
                <td><StatusBadge status={item.equipment?.status} /></td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.moved_at ? fmtDate(item.moved_at) : '—'}</td>
                <td style={{ padding: '0 8px' }}>
                  {problema && (
                    <button
                      type="button"
                      title="Reportar problema ao TI"
                      onClick={() => onReport(item)}
                      style={{ background: 'rgba(239,68,68,.1)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}
                    >
                      <MessageSquareWarning size={13} />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
