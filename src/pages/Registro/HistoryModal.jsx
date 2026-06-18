import { useEffect, useState } from "react"
import { X, ArrowRightLeft } from "lucide-react"
import { supabase } from "../../lib/supabase.js"
import { useToast } from "../../contexts/ToastContext.jsx"
import { fmtDateTime } from "../../utils/format.js"

export function HistoryModal({ item, onClose }) {
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
