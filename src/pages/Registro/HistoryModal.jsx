import { useEffect, useState } from "react"
import { X, ArrowRightLeft, MapPin, ClipboardList, LayoutGrid, CheckCircle2, XCircle, AlertTriangle, Package } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { fmtDateTime, formatAssetNumber } from "../../utils/format.js"
import { StatusBadge } from "../Registro.shared.jsx"

// ── Helpers ────────────────────────────────────────────────────────────────────

const CONF_STATUS = {
  ok:           { label: 'Ok',           color: '#059669', bg: 'rgba(16,185,129,.13)', Icon: CheckCircle2 },
  ausente:      { label: 'Ausente',      color: '#dc2626', bg: 'rgba(239,68,68,.13)',  Icon: XCircle },
  com_problema: { label: 'Com Problema', color: '#d97706', bg: 'rgba(245,158,11,.13)', Icon: AlertTriangle },
}

function compLabel(comp) {
  if (!comp) return '—'
  const [y, m] = comp.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 18px',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
        borderBottom: active ? '2px solid var(--accent-color)' : '2px solid transparent',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent-color)' : '2px solid transparent',
        cursor: 'pointer',
        marginBottom: -1,
        transition: 'color .15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Sub-views ──────────────────────────────────────────────────────────────────

function OverviewTab({ item }) {
  const eq = item.equipment || {}
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Status + localização */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        background: 'var(--bg-main)', borderRadius: 12, padding: 16,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Status</div>
          <StatusBadge status={eq.status} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Localização atual</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 600 }}>
            <MapPin size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
            {item.room?.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Não localizado</span>}
          </div>
        </div>
        {item.asset_number && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Nº Patrimônio</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{formatAssetNumber(item.asset_number)}</div>
          </div>
        )}
        {item.serial_number && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Nº Série</div>
            <div style={{ fontSize: 14, fontFamily: 'monospace' }}>{item.serial_number}</div>
          </div>
        )}
        {eq.categoria && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Categoria</div>
            <div style={{ fontSize: 13 }}>{eq.categoria}</div>
          </div>
        )}
        {eq.dominio && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Classificação</div>
            <div style={{ fontSize: 13 }}>{eq.dominio}</div>
          </div>
        )}
        {item.moved_at && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Último registro</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtDateTime(item.moved_at)}</div>
          </div>
        )}
        {item.received_by && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Com quem está</div>
            <div style={{ fontSize: 13 }}>{item.received_by}</div>
          </div>
        )}
      </div>
      {eq.observacao && (
        <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Observação</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{eq.observacao}</div>
        </div>
      )}
    </div>
  )
}

function MovementsTab({ movements }) {
  if (!movements) return <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando…</div>
  if (movements.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Nenhuma movimentação registrada.
    </div>
  )
  return (
    <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
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
  )
}

function ConferencesTab({ conferences }) {
  if (!conferences) return <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando…</div>
  if (conferences.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <ClipboardList size={28} style={{ opacity: .2, display: 'block', margin: '0 auto 8px' }} />
      Este ativo não apareceu em nenhuma conferência ainda.
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
      {conferences.map((c) => {
        const cfg = CONF_STATUS[c.status] || CONF_STATUS.ok
        const Icon = cfg.Icon
        return (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'var(--bg-main)', borderRadius: 10, padding: '12px 14px',
            border: `1px solid ${cfg.bg}`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: cfg.bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={15} style={{ color: cfg.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{compLabel(c.conference?.competencia)}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                  background: cfg.bg, color: cfg.color,
                }}>{cfg.label}</span>
              </div>
              {c.conference?.room?.name && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {c.conference.room.name}
                </div>
              )}
              {c.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>{c.notes}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal principal ────────────────────────────────────────────────────────────

export function HistoryModal({ item, onClose }) {
  const { showToast } = useToast()
  const [tab, setTab] = useState('overview')
  const [movements, setMovements] = useState(null)
  const [conferences, setConferences] = useState(null)

  const name = item.equipment?.name || '—'
  const pat  = item.asset_number ? formatAssetNumber(item.asset_number) : null

  useEffect(() => {
    const loadMovements = async () => {
      let q = supabase
        .from('asset_movements')
        .select('id, asset_number, moved_at, received_by, origin_room_id, destination_room_id, moved_by')
        .is('deleted_at', null)
        .order('moved_at', { ascending: false })

      if (item.asset_number)                              q = q.eq('asset_number', item.asset_number)
      else if (item.serial_number && item.equipment_id)  q = q.eq('equipment_id', item.equipment_id).eq('serial_number', item.serial_number)
      else if (item.equipment_id)                         q = q.eq('equipment_id', item.equipment_id)

      const { data: movs, error } = await q
      if (error) { showToast('Erro ao carregar histórico: ' + error.message, 'danger'); return }
      if (!movs?.length) { setMovements([]); return }

      const roomIds    = [...new Set([...movs.map(m => m.origin_room_id), ...movs.map(m => m.destination_room_id)].filter(Boolean))]
      const profileIds = [...new Set(movs.map(m => m.moved_by).filter(Boolean))]
      const [{ data: rooms }, { data: profiles }] = await Promise.all([
        roomIds.length    ? supabase.from('rooms').select('id, name').in('id', roomIds)       : Promise.resolve({ data: [] }),
        profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds) : Promise.resolve({ data: [] }),
      ])
      const roomMap    = Object.fromEntries((rooms    || []).map(r => [r.id, r]))
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      setMovements(movs.map(m => ({
        ...m,
        origin_room:      roomMap[m.origin_room_id]      || null,
        destination_room: roomMap[m.destination_room_id] || null,
        profile:          profileMap[m.moved_by]         || null,
      })))
    }

    const loadConferences = async () => {
      if (!item.asset_number) { setConferences([]); return }
      const { data: items } = await supabase
        .from('conference_items')
        .select('id, status, notes, asset_number, room_conference_id')
        .eq('asset_number', item.asset_number)
      if (!items?.length) { setConferences([]); return }

      const rcIds = [...new Set(items.map(c => c.room_conference_id).filter(Boolean))]
      const { data: rcs } = rcIds.length
        ? await supabase.from('room_conferences').select('id, competencia, concluded_at, room_id, room:room_id(name)').in('id', rcIds)
        : { data: [] }
      const rcMap = Object.fromEntries((rcs || []).map(r => [r.id, r]))
      setConferences(
        items
          .map(ci => ({ ...ci, conference: rcMap[ci.room_conference_id] || null }))
          .sort((a, b) => (b.conference?.competencia || '').localeCompare(a.conference?.competencia || ''))
      )
    }

    loadMovements()
    loadConferences()
  }, [item.asset_number, item.serial_number, item.equipment_id, showToast])

  const movCount  = movements?.length ?? '…'
  const confCount = conferences?.length ?? '…'

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h3>Histórico do Ativo</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {name}{pat ? <> · <span style={{ fontFamily: 'monospace' }}>{pat}</span></> : ''}
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20, gap: 0 }}>
          <TabBtn active={tab === 'overview'}     onClick={() => setTab('overview')}>
            <LayoutGrid size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Visão Geral
          </TabBtn>
          <TabBtn active={tab === 'movements'}    onClick={() => setTab('movements')}>
            <ArrowRightLeft size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Movimentações ({movCount})
          </TabBtn>
          <TabBtn active={tab === 'conferences'}  onClick={() => setTab('conferences')}>
            <ClipboardList size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Conferências ({confCount})
          </TabBtn>
        </div>

        {tab === 'overview'    && <OverviewTab item={item} />}
        {tab === 'movements'   && <MovementsTab movements={movements} />}
        {tab === 'conferences' && <ConferencesTab conferences={conferences} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
