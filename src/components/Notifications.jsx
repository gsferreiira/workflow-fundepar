import { useEffect, useState } from 'react'
import { X, BellOff, ArrowRightLeft, Package, Eye, MapPin, ArrowRight, User } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { formatAssetNumber } from '../utils/format.js'

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

export function NotificationsPanel({ open, onClose, items, onShowDetail }) {
  if (!open) return null
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
        <div className="notif-list">
          {items.length === 0 ? (
            <div className="notif-empty">
              <BellOff size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
              Nenhuma atividade ainda.
            </div>
          ) : (
            items.map((item) => {
              const lastSeen = localStorage.getItem('notif_last_seen')
                ? new Date(localStorage.getItem('notif_last_seen'))
                : null
              const isNew = !lastSeen || item.date > lastSeen
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
 */
export function useNotifications() {
  const [items, setItems] = useState([])
  const [badge, setBadge] = useState(0)

  const refresh = async () => {
    const [{ data: movements }, { data: equipment }, { data: profiles }] = await Promise.all([
      supabase
        .from('asset_movements')
        .select(
          'id, equipment(name), moved_by, moved_at, destination_room:destination_room_id(name), origin_room:origin_room_id(name), asset_number, serial_number, received_by',
        )
        .is('deleted_at', null)
        .order('moved_at', { ascending: false })
        .limit(15),
      supabase
        .from('equipment')
        .select('id, name, created_by, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('profiles').select('id, full_name').is('deleted_at', null),
    ])

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
    const lastSeen = localStorage.getItem('notif_last_seen')
      ? new Date(localStorage.getItem('notif_last_seen'))
      : null

    const collected = [
      ...(movements || []).map((m) => ({
        id: 'mov_' + m.id,
        refId: m.id,
        type: 'movement',
        actor: profileMap[m.moved_by]?.full_name || 'Alguém',
        date: new Date(m.moved_at),
        data: m,
      })),
      ...(equipment || []).map((e) => ({
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
    const unseen = lastSeen ? collected.filter((i) => i.date > lastSeen).length : collected.length
    setBadge(unseen)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAsSeen = () => {
    localStorage.setItem('notif_last_seen', new Date().toISOString())
    setBadge(0)
  }

  return { items, badge, refresh, markAsSeen }
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
