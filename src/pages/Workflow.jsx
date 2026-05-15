import { useEffect, useState, useRef } from 'react'
import {
  Plus,
  X,
  AlertCircle,
  Loader2,
  CheckCircle,
  Trash2,
  MapPin,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonKanban } from '../components/Skeleton.jsx'

const STATUSES = [
  { key: 'aberto', label: 'Abertos', color: undefined, icon: AlertCircle },
  { key: 'em_progresso', label: 'Em Progresso', color: 'var(--warning-color)', icon: Loader2 },
  { key: 'resolvido', label: 'Resolvidos', color: 'var(--success-color)', icon: CheckCircle },
]

export function Workflow() {
  const { user } = useAuth()
  const { rooms: roomsFetcher } = useStore()
  const { showToast, confirm } = useToast()
  const audit = useAudit()
  const [tickets, setTickets] = useState(null)
  const [activeTab, setActiveTab] = useState('aberto')
  const [createModal, setCreateModal] = useState(false)
  const [detailTicket, setDetailTicket] = useState(null)
  const [rooms, setRooms] = useState([])
  const isDraggingRef = useRef(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, rooms(name), profiles:requester_id(full_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) {
      showToast(error.message, 'danger')
      return
    }
    setTickets(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const openCreateModal = async () => {
    setRooms(await roomsFetcher())
    setCreateModal(true)
  }

  const cols = tickets
    ? STATUSES.reduce((acc, s) => {
        acc[s.key] = tickets.filter((t) => t.status === s.key)
        return acc
      }, {})
    : {}

  const onDragStart = (e, ticketId) => {
    isDraggingRef.current = true
    e.dataTransfer.setData('ticketId', ticketId)
  }
  const onDragEnd = () => {
    setTimeout(() => {
      isDraggingRef.current = false
    }, 100)
  }
  const onDragOver = (e) => e.preventDefault()
  const onDrop = async (e, newStatus) => {
    e.preventDefault()
    const ticketId = e.dataTransfer.getData('ticketId')
    if (!ticketId) return
    const t = tickets.find((x) => x.id === ticketId)
    if (!t || t.status === newStatus) return
    const { error } = await supabase.from('tickets').update({ status: newStatus }).eq('id', ticketId)
    if (error) {
      showToast('Falha ao atualizar status.', 'danger')
      return
    }
    audit.updated('tickets', ticketId, { status: newStatus, via: 'drag' })
    await load()
  }

  const moveTicket = async (id, newStatus) => {
    const { error } = await supabase.from('tickets').update({ status: newStatus }).eq('id', id)
    if (error) {
      showToast('Erro ao mover chamado.', 'danger')
      return
    }
    audit.updated('tickets', id, { status: newStatus })
    setDetailTicket(null)
    showToast('Status atualizado!', 'success')
    await load()
  }

  const deleteTicket = async (id) => {
    const ok = await confirm({
      title: 'Excluir chamado',
      message:
        'Tem certeza que deseja excluir este chamado? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { data, error } = await supabase
      .from('tickets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
    if (error || !data?.length) {
      showToast(error?.message || 'Sem permissão para excluir.', 'danger')
      return
    }
    audit.deleted('tickets', id)
    setDetailTicket(null)
    showToast('Chamado excluído.', 'success')
    await load()
  }

  const handleClickCard = (ticket) => {
    if (isDraggingRef.current) return
    setDetailTicket(ticket)
  }

  if (!tickets) return <SkeletonKanban />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Painel Kanban (Workflow)</h2>
          <p>Desktop: arraste os cartões. Mobile: toque para ver detalhes e mover.</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={14} /> Abrir Chamado
        </button>
      </div>
      <div className="kanban-tabs">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            className={`kanban-tab${activeTab === s.key ? ' active' : ''}`}
            onClick={() => setActiveTab(s.key)}
          >
            {s.label} <span style={{ opacity: 0.7 }}>({cols[s.key].length})</span>
          </button>
        ))}
      </div>
      <div className="kanban-board fade-in">
        {STATUSES.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.key}
              className={`kanban-column${activeTab === s.key ? ' active' : ''}`}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, s.key)}
            >
              <div className="kanban-header" style={s.color ? { color: s.color } : undefined}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={18} /> {s.label}
                </span>
                <span className="count">{cols[s.key].length}</span>
              </div>
              <div className="kanban-cards">
                {cols[s.key].length === 0 ? (
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 13,
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    Nenhum chamado
                  </p>
                ) : (
                  cols[s.key].map((t) => (
                    <div
                      key={t.id}
                      className="kanban-card"
                      draggable="true"
                      onDragStart={(e) => onDragStart(e, t.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => handleClickCard(t)}
                    >
                      <h4>{t.title}</h4>
                      <p>{t.description}</p>
                      <div className="kanban-card-meta">
                        <span className={`badge-status ${t.priority}`}>{t.priority}</span>
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <MapPin size={12} /> {t.rooms?.name || 'Sem local'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {createModal && (
        <CreateTicketModal
          rooms={rooms}
          onClose={() => setCreateModal(false)}
          onCreated={async () => {
            setCreateModal(false)
            await load()
          }}
        />
      )}
      {detailTicket && (
        <DetailModal
          ticket={detailTicket}
          currentUser={user}
          onClose={() => setDetailTicket(null)}
          onMove={moveTicket}
          onDelete={deleteTicket}
        />
      )}
    </>
  )
}

function CreateTicketModal({ rooms, onClose, onCreated }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const audit = useAudit()
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [roomId, setRoomId] = useState('')
  const [priority, setPriority] = useState('media')

  const handle = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { data: inserted, error } = await supabase
      .from('tickets')
      .insert([
        {
          title: title.trim(),
          description: desc.trim(),
          room_id: roomId,
          priority,
          requester_id: user.id,
          status: 'aberto',
        },
      ])
      .select('id')
      .single()
    if (error) {
      showToast('Erro ao criar chamado: ' + error.message, 'danger')
      setBusy(false)
      return
    }
    audit.created('tickets', inserted?.id, { title: title.trim() })
    showToast('Chamado aberto com sucesso!', 'success')
    onCreated()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Solicitação de Atendimento</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handle}>
          <div className="form-group">
            <label>Título / Resumo do Problema</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: Projetor não liga"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Descrição Completa</label>
            <textarea
              className="form-control"
              required
              rows="4"
              placeholder="Detalhe o que está acontecendo..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>Local afetado</label>
              <select
                className="form-control"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="" disabled>
                  Selecione a sala...
                </option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nível de Prioridade</label>
              <select
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#e2e8f0', color: '#475569' }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetailModal({ ticket, currentUser, onClose, onMove, onDelete }) {
  const statusLabels = { aberto: 'Aberto', em_progresso: 'Em Progresso', resolvido: 'Resolvido' }
  const moveIcons = { aberto: AlertCircle, em_progresso: Loader2, resolvido: CheckCircle }
  const others = ['aberto', 'em_progresso', 'resolvido'].filter((s) => s !== ticket.status)
  const canDelete =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'tecnico' ||
    ticket.requester_id === currentUser?.id

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge-status ${ticket.priority}`}>{ticket.priority}</span>
            <span className={`badge-status ${ticket.status}`}>
              {statusLabels[ticket.status] || ticket.status}
            </span>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <h3
          style={{
            fontSize: 18,
            color: 'var(--primary-color)',
            marginBottom: 12,
            fontWeight: 700,
          }}
        >
          {ticket.title}
        </h3>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 24,
            whiteSpace: 'pre-wrap',
          }}
        >
          {ticket.description}
        </p>
        <div className="detail-meta-grid">
          <div className="detail-meta-item">
            <span className="detail-meta-label">Local</span>
            <span>{ticket.rooms?.name || '—'}</span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-label">Solicitante</span>
            <span>{ticket.profiles?.full_name || '—'}</span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-label">Aberto em</span>
            <span>{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
          {others.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                  letterSpacing: '.5px',
                }}
              >
                Mover para
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {others.map((s) => {
                  const Icon = moveIcons[s]
                  return (
                    <button key={s} className="btn-move-status" onClick={() => onMove(ticket.id, s)}>
                      <Icon size={14} /> {statusLabels[s]}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {canDelete && (
            <button className="btn-danger" onClick={() => onDelete(ticket.id)}>
              <Trash2 size={14} /> Excluir Chamado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
