import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, BellOff, ArrowRightLeft, Package, Eye, MapPin, ArrowRight, AlertTriangle, ClipboardList, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { formatAssetNumber } from '../utils/format.js'
import { useRealtime } from '../hooks/useRealtime.js'

const relativeTime = (date) => {
  const diff = Date.now() - date
  const min = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (min < 1) return 'Agora mesmo'
  if (min < 60) return `${min} min atrás`
  if (h < 24) return `${h}h atrás`
  if (d < 7) return `${d}d atrás`
  return date.toLocaleDateString('pt-BR')
}

// Acesso seguro a localStorage — modo privado/quota cheia não derruba o app.
const safeGetItem = (key) => {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}
const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    /* noop */
  }
}

// ── Alert definitions ─────────────────────────────────────────────────────────

const ALERT_DEFS = {
  problem: {
    icon:  AlertTriangle,
    color: '#dc2626',
    bg:    'rgba(239,68,68,.08)',
    border:'rgba(239,68,68,.2)',
    label: 'Bens com problema',
    link:  '/registro',
    linkLabel: 'Ver no inventário',
  },
  conference: {
    icon:  ClipboardList,
    color: '#d97706',
    bg:    'rgba(245,158,11,.08)',
    border:'rgba(245,158,11,.2)',
    label: 'Conferências pendentes (mês atual)',
    link:  '/conferencias',
    linkLabel: 'Ver conferências',
  },
  unlocated: {
    icon:  Search,
    color: '#7e22ce',
    bg:    'rgba(126,34,206,.08)',
    border:'rgba(126,34,206,.2)',
    label: 'Patrimônios sem localização',
    link:  '/registro',
    linkLabel: 'Ver no inventário',
  },
}

function AlertCard({ type, count, onClose }) {
  const def = ALERT_DEFS[type]
  if (!def || count === 0) return null
  const Icon = def.icon
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: def.bg, border: `1px solid ${def.border}`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: def.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={14} style={{ color: def.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: def.color }}>{count} {def.label}</div>
      </div>
      <Link
        to={def.link}
        onClick={onClose}
        style={{ fontSize: 11, color: def.color, fontWeight: 600, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        {def.linkLabel} →
      </Link>
    </div>
  )
}

export function NotificationsPanel({ open, onClose, items, onShowDetail, seenAt, alerts = [] }) {
  if (!open) return null
  const hasAlerts = alerts.some(a => a.count > 0)
  return (
    <>
      <div id="notifications-backdrop" className="notifications-backdrop active" onClick={onClose}></div>
      <div id="notifications-panel" className="notifications-panel">
        <div className="notif-header">
          <h4>Notificações</h4>
          <button className="btn-icon" style={{ width: 30, height: 30 }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {hasAlerts && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--border-color)', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
              Alertas
            </div>
            {alerts.map(a => <AlertCard key={a.type} type={a.type} count={a.count} onClose={onClose} />)}
          </div>
        )}

        <div className="notif-list">
          {items.length === 0 ? (
            <div className="notif-empty">
              <BellOff size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
              Nenhuma atividade ainda.
            </div>
          ) : (
            items.map((item) => {
              const isNew = !seenAt || item.date > seenAt
              return (
                <div className={`notif-item${isNew ? ' unread' : ''}`} key={item.id}>
                  <div className={`notif-icon ${item.type}`}>
                    {item.type === 'movement' ? (
                      <ArrowRightLeft size={15} />
                    ) : (
                      <Package size={15} />
                    )}
                  </div>
                  <div className="notif-body">
                    <div className="notif-msg">
                      <strong>{item.actor}</strong>
                      {item.type === 'movement' ? (
                        <>
                          {' '}registrou movimentação de{' '}
                          <strong>{item.data.equipment?.name || 'equipamento'}</strong> para{' '}
                          <strong>{item.data.destination_room?.name || '—'}</strong>
                        </>
                      ) : (
                        <>
                          {' '}cadastrou o equipamento <strong>{item.data.name}</strong>
                        </>
                      )}
                    </div>
                    <div className="notif-time">{relativeTime(item.date)}</div>
                    <span className="notif-detail-btn" onClick={() => onShowDetail(item)}>
                      <Eye size={12} /> Ver detalhes
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Hook que busca e mantém em estado as notificações + badge.
 *
 * `seenAt` é o estado React (fonte de verdade). O localStorage serve apenas
 * para persistir entre sessões — se falhar silenciosamente, o sistema continua
 * funcionando dentro da sessão sem entrar em loop infinito.
 */
// roomId: quando passado, filtra notificações apenas para aquela sala (coordenador)
export function useNotifications({ roomId } = {}) {
  const storageKey = roomId ? `notif_last_seen_room_${roomId}` : 'notif_last_seen'

  const [items, setItems] = useState([])
  const [badge, setBadge] = useState(0)
  const [seenAt, setSeenAt] = useState(() => {
    const raw = safeGetItem(storageKey)
    return raw ? new Date(raw) : null
  })
  const seenAtRef = useRef(seenAt)
  seenAtRef.current = seenAt

  const refresh = useCallback(async () => {
    let movQuery = supabase
      .from('asset_movements')
      .select(
        'id, equipment(name), moved_by, moved_at, destination_room:destination_room_id(name), origin_room:origin_room_id(name), asset_number, serial_number, received_by',
      )
      .is('deleted_at', null)
      .order('moved_at', { ascending: false })
      .limit(15)

    if (roomId) movQuery = movQuery.eq('destination_room_id', roomId)

    const queries = [movQuery, supabase.from('profiles').select('id, full_name').is('deleted_at', null)]

    // Coordenadores veem apenas movimentações do setor; cadastros globais de equipamento só para TI
    if (!roomId) {
      queries.splice(1, 0,
        supabase
          .from('equipment')
          .select('id, name, created_by, created_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
      )
    }

    const results = await Promise.all(queries)
    const movements = results[0].data || []
    const equipment = roomId ? [] : (results[1].data || [])
    const profiles  = roomId ? (results[1].data || []) : (results[2].data || [])

    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))

    const collected = [
      ...movements.map((m) => ({
        id: 'mov_' + m.id,
        refId: m.id,
        type: 'movement',
        actor: profileMap[m.moved_by]?.full_name || 'Alguém',
        date: new Date(m.moved_at),
        data: m,
      })),
      ...equipment.map((e) => ({
        id: 'eq_' + e.id,
        refId: e.id,
        type: 'equipment',
        actor: profileMap[e.created_by]?.full_name || 'Alguém',
        date: new Date(e.created_at),
        data: e,
      })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 25)

    setItems(collected)
    const seen = seenAtRef.current
    const unseen = seen ? collected.filter((i) => i.date > seen).length : collected.length
    setBadge(unseen)
  }, [roomId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const throttleRef = useRef(null)
  const throttledRefresh = useCallback(() => {
    if (throttleRef.current) return
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null
      refresh()
    }, 1500)
  }, [refresh])

  useRealtime('asset_movements', throttledRefresh, { event: 'INSERT' })
  useRealtime('equipment', throttledRefresh, { event: 'INSERT' })

  useEffect(() => () => {
    if (throttleRef.current) clearTimeout(throttleRef.current)
  }, [])

  const markAsSeen = useCallback(() => {
    const now = new Date()
    safeSetItem(storageKey, now.toISOString())
    seenAtRef.current = now
    setSeenAt(now)
    setBadge(0)
  }, [storageKey])

  return { items, badge, seenAt, refresh, markAsSeen }
}

const ALERT_ROLES = ['admin', 'tecnico', 'patrimonio']

export function useAlerts({ role } = {}) {
  const [alerts, setAlerts] = useState([])

  const load = useCallback(async () => {
    if (!ALERT_ROLES.includes(role)) { setAlerts([]); return }
    const currentMonth = new Date().toISOString().slice(0, 7)

    const [locsRes, confRes, unlocRes] = await Promise.all([
      supabase
        .from('equipment_locations')
        .select('id, equipment_id, equipment(status)')
        .not('equipment', 'is', null),
      supabase
        .from('room_conferences')
        .select('id')
        .eq('competencia', currentMonth)
        .is('concluded_at', null)
        .is('deleted_at', null),
      // Conta patrimônios registrados mas sem sala definida (current_room_id nulo)
      supabase
        .from('equipment_locations')
        .select('id', { count: 'exact', head: true })
        .is('current_room_id', null),
    ])

    const problemCount = (locsRes.data || []).filter(l =>
      ['inservível', 'com defeito'].includes(l.equipment?.status),
    ).length

    const confCount = (confRes.data || []).length

    const unlocatedCount = unlocRes.count || 0

    setAlerts([
      { type: 'problem',    count: problemCount   },
      { type: 'conference', count: confCount      },
      { type: 'unlocated',  count: unlocatedCount },
    ])
  }, [role])

  useEffect(() => {
    load().catch(() => {})
    const timer = setInterval(() => load().catch(() => {}), 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [load])

  const alertCount = alerts.reduce((sum, a) => sum + a.count, 0)
  return { alerts, alertCount }
}

export function NotificationDetailModal({ item, onClose }) {
  if (!item) return null
  const m = item.data
  if (item.type === 'movement') {
    return (
      <div className="modal-overlay" id="notif-detail-modal">
        <div className="modal-content" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <div>
              <h3>Detalhes da Movimentação</h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {new Date(m.moved_at).toLocaleString('pt-BR')}
              </div>
            </div>
            <button className="modal-close" type="button" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  background: 'rgba(99,102,241,.1)',
                  color: '#6366f1',
                  padding: 10,
                  borderRadius: 10,
                }}
              >
                <Package size={20} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Equipamento
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{m.equipment?.name || '—'}</div>
                {m.asset_number && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    PAT: {formatAssetNumber(m.asset_number)}
                  </div>
                )}
                {m.serial_number && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Série: {m.serial_number}
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 40px 1fr',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-main)',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Origem
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} style={{ color: 'var(--text-secondary)' }} />
                  {m.origin_room?.name || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--accent-color)' }}>
                <ArrowRight size={18} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Destino
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--accent-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <MapPin size={13} />
                  {m.destination_room?.name || '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 3,
                  }}
                >
                  Responsável
                </div>
                <div style={{ fontSize: 14 }}>{item.actor}</div>
              </div>
              {m.received_by && (
                <div style={{ flex: 1, minWidth: 130 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: 3,
                    }}
                  >
                    Recebedor
                  </div>
                  <div style={{ fontSize: 14 }}>{m.received_by}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
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
  return (
    <div className="modal-overlay" id="notif-detail-modal">
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div>
            <h3>Equipamento Cadastrado</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {new Date(m.created_at).toLocaleString('pt-BR')}
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'var(--bg-main)',
            borderRadius: 10,
            padding: 16,
            marginTop: 8,
          }}
        >
          <div
            style={{
              background: 'rgba(99,102,241,.1)',
              color: '#6366f1',
              padding: 12,
              borderRadius: 10,
              flexShrink: 0,
            }}
          >
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
              Cadastrado por <strong>{item.actor}</strong>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
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
