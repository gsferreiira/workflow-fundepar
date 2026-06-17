import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Package, User, Monitor, Cpu, Printer, Keyboard, HardDrive, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
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
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  )
}

export function MapaSetor() {
  const { sigla } = useParams()
  const { user } = useAuth()
  const room = user?.coordinator_room
  const [items, setItems] = useState(null)
  const [loadError, setLoadError] = useState(null)

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

    // Busca equipamentos e a movimentação mais recente de entrada em cada asset
    const secondaryResults = await Promise.all([
      eqIds.length > 0
        ? supabase.from('equipment').select('id, name, categoria, status').in('id', eqIds)
        : { data: [] },
      assetNumbers.length > 0
        ? supabase
            .from('asset_movements')
            .select('asset_number, received_by, moved_at')
            .eq('destination_room_id', room.id)
            .in('asset_number', assetNumbers)
            .is('deleted_at', null)
            .order('moved_at', { ascending: false })
        : { data: [] },
    ]).catch((err) => { setLoadError(err.message); setItems([]); return null })
    if (!secondaryResults) return
    const [eqRes, movRes] = secondaryResults

    const eqMap = Object.fromEntries((eqRes.data || []).map((e) => [e.id, e]))

    // Pega o received_by da movimentação mais recente por asset (já vem ordenado desc)
    const receivedByMap = {}
    for (const mov of (movRes.data || [])) {
      if (!(mov.asset_number in receivedByMap)) {
        receivedByMap[mov.asset_number] = mov.received_by || null
      }
    }

    setItems(locs.map((loc) => ({
      ...loc,
      equipment:   eqMap[loc.equipment_id] || null,
      // received_by: prioridade para o campo da tabela, fallback para movimentação mais recente
      received_by: loc.received_by || receivedByMap[loc.asset_number] || null,
    })))
  }, [room?.id])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    if (!items) return []
    const map = new Map()
    for (const item of items) {
      const name = item.received_by || null
      const key  = name || '__none__'
      if (!map.has(key)) {
        map.set(key, { key, name, items: [] })
      }
      map.get(key).items.push(item)
    }
    return [...map.values()].sort((a, b) => {
      if (!a.name && b.name) return 1
      if (a.name && !b.name) return -1
      return (a.name || '').localeCompare(b.name || '', 'pt-BR')
    })
  }, [items])

  if (!room) return <SkeletonTable />

  if (loadError) return (
    <div style={{
      margin: '40px 0', padding: '20px 24px', borderRadius: 12,
      background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
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
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap',
          }}>
            <SummaryChip label="Equipamentos" value={items.length} color="#6366f1" bg="rgba(99,102,241,.08)" />
            <SummaryChip label="Responsáveis" value={groups.filter((g) => g.name).length} color="#059669" bg="rgba(16,185,129,.08)" />
            {groups.some((g) => !g.name) && (
              <SummaryChip label="Sem responsável" value={groups.find((g) => !g.name)?.items.length || 0} color="#d97706" bg="rgba(245,158,11,.08)" />
            )}
          </div>
        )}
      </div>

      {!items ? (
        <SkeletonTable />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <Package size={48} style={{ opacity: 0.2, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15 }}>Nenhum equipamento registrado nesta sala.</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            Quando o TI registrar movimentações para este setor, os equipamentos aparecerão aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map((group) => (
            <PersonCard key={group.key} group={group} />
          ))}
        </div>
      )}
    </>
  )
}

function SummaryChip({ label, value, color, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 10,
      padding: '10px 16px', borderLeft: `3px solid ${color}`,
      minWidth: 110,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function PersonCard({ group }) {
  const initials = group.name
    ? group.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('')
    : '?'

  return (
    <div className="table-card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Cabeçalho da pessoa */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-color)',
        background: group.name ? 'rgba(99,102,241,.03)' : 'rgba(245,158,11,.03)',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: group.name ? 'rgba(99,102,241,.12)' : 'rgba(245,158,11,.12)',
          color: group.name ? '#6366f1' : '#d97706',
          fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
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

      {/* Tabela de equipamentos */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Equipamento</th>
            <th>Categoria</th>
            <th>Nº Patrimônio</th>
            <th>Nº Série</th>
            <th>Status</th>
            <th>Última mov.</th>
          </tr>
        </thead>
        <tbody>
          {group.items.map((item, idx) => {
            const Icon = categoriaIcon(item.equipment?.categoria)
            return (
              <tr key={item.asset_number || item.equipment_id || idx}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <strong>{item.equipment?.name || '—'}</strong>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {item.equipment?.categoria || '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {item.asset_number ? formatAssetNumber(item.asset_number) : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {item.serial_number || '—'}
                </td>
                <td>
                  <StatusBadge status={item.equipment?.status} />
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {item.moved_at ? fmtDate(item.moved_at) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
