import { useCallback, useEffect, useState } from 'react'
import {
  Plus, X, Loader2, CheckCircle2, Clock, MapPin, User,
  Play, MessageSquare, ArrowRightLeft, Settings, Trash2,
  AlertCircle, ChevronRight, Send,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { useRealtime } from '../hooks/useRealtime.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { fmtDateTime } from '../utils/format.js'

// ─── Prioridade de sala ────────────────────────────────────────────────────────
const ROOM_PRIORITY = {
  1: { label: 'Normal',   color: '#64748b', bg: 'rgba(100,116,139,.12)', border: 'var(--border-color)' },
  2: { label: 'Alta',     color: '#d97706', bg: 'rgba(217,119,6,.12)',   border: '#d97706' },
  3: { label: 'Crítica',  color: '#dc2626', bg: 'rgba(220,38,38,.12)',   border: '#dc2626' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function PriorityBadge({ level = 1, style }) {
  const p = ROOM_PRIORITY[level] || ROOM_PRIORITY[1]
  return (
    <span style={{
      background: p.bg, color: p.color,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px',
      ...style,
    }}>
      {p.label}
    </span>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{
      textAlign: 'center', padding: '40px 0',
      color: 'var(--text-secondary)', fontSize: 14,
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px dashed var(--border-color)',
    }}>
      {message}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function Workflow() {
  const { user } = useAuth()
  const { rooms: roomsFetcher } = useStore()
  const { showToast, confirm } = useToast()
  const audit = useAudit()

  const [tickets, setTickets]         = useState(null)
  const [view, setView]               = useState('base')
  const [rooms, setRooms]             = useState([])
  const [techs, setTechs]             = useState([])
  const [createOpen, setCreateOpen]   = useState(false)
  const [detailId, setDetailId]       = useState(null)
  const [priorityOpen, setPriorityOpen] = useState(false)

  const isAdmin = user?.role === 'admin'
  const isTech  = user?.role === 'tecnico' || isAdmin

  // ── Carregamento ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        room:rooms(id, name, priority_level),
        requester:profiles!requester_id(id, full_name),
        assignee:profiles!assigned_to(id, full_name)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'danger'); return }
    setTickets(data || [])
  }, [showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const init = async () => {
      const rm = await roomsFetcher()
      setRooms(rm)
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .is('deleted_at', null)
        .in('role', ['admin', 'tecnico'])
        .order('full_name')
      setTechs(data || [])
    }
    init()
  }, [roomsFetcher])

  useRealtime('tickets', useCallback(() => load(), [load]))

  // ── Filtros de exibição por aba ─────────────────────────────────────────────
  const baseTickets = (tickets || [])
    .filter(t => t.status === 'aberto' && !t.assigned_to)
    .sort((a, b) => {
      const diff = (b.room?.priority_level || 1) - (a.room?.priority_level || 1)
      return diff !== 0 ? diff : new Date(a.created_at) - new Date(b.created_at)
    })

  const activeTickets = (tickets || [])
    .filter(t => t.status === 'em_atendimento')
    .filter(t => isAdmin || t.assigned_to === user?.id)
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))

  const doneTickets = (tickets || [])
    .filter(t => t.status === 'finalizado')
    .filter(t => isAdmin || t.assigned_to === user?.id || t.requester_id === user?.id)

  const today = new Date().toDateString()
  const doneToday = (tickets || []).filter(t =>
    t.status === 'finalizado' && new Date(t.finished_at).toDateString() === today,
  ).length

  // ── Ações ───────────────────────────────────────────────────────────────────
  const inicializar = async (ticketId) => {
    const { error } = await supabase.from('tickets').update({
      status: 'em_atendimento',
      assigned_to: user.id,
      started_at: new Date().toISOString(),
    }).eq('id', ticketId).is('assigned_to', null)

    if (error) { showToast('Erro ao inicializar: ' + error.message, 'danger'); return }

    await supabase.from('ticket_records').insert({
      ticket_id: ticketId, author_id: user.id,
      content: `Atendimento iniciado por ${user.full_name}.`, type: 'system',
    })
    audit.updated('tickets', ticketId, { action: 'inicializado', by: user.id })
    showToast('OS iniciada! Veja em "Em Atendimento".', 'success')
    setView('em_atendimento')
    await load()
  }

  const finalizar = async (ticketId, conclusion) => {
    const { error } = await supabase.from('tickets').update({
      status: 'finalizado',
      finished_at: new Date().toISOString(),
    }).eq('id', ticketId)
    if (error) { showToast('Erro ao finalizar: ' + error.message, 'danger'); return }

    const records = []
    if (conclusion?.trim()) {
      records.push({ ticket_id: ticketId, author_id: user.id, content: conclusion.trim(), type: 'conclusion' })
    }
    records.push({ ticket_id: ticketId, author_id: user.id, content: `OS finalizada por ${user.full_name}.`, type: 'system' })
    await supabase.from('ticket_records').insert(records)

    audit.updated('tickets', ticketId, { action: 'finalizado', by: user.id })
    showToast('OS finalizada com sucesso!', 'success')
    setDetailId(null)
    setView('finalizados')
    await load()
  }

  const repassar = async (ticketId, newTechId, newTechName) => {
    const old = tickets?.find(t => t.id === ticketId)
    const { error } = await supabase.from('tickets')
      .update({ assigned_to: newTechId }).eq('id', ticketId)
    if (error) { showToast('Erro ao repassar: ' + error.message, 'danger'); return false }

    await supabase.from('ticket_records').insert({
      ticket_id: ticketId, author_id: user.id,
      content: `OS repassada de ${old?.assignee?.full_name || user.full_name} para ${newTechName}.`,
      type: 'system',
    })
    audit.updated('tickets', ticketId, { action: 'repassado', to: newTechId })
    showToast(`OS repassada para ${newTechName}.`, 'success')
    await load()
    return true
  }

  const addRecord = async (ticketId, content) => {
    const { error } = await supabase.from('ticket_records').insert({
      ticket_id: ticketId, author_id: user.id, content: content.trim(), type: 'comment',
    })
    if (error) { showToast('Erro ao adicionar registro.', 'danger'); return false }
    return true
  }

  const deleteTicket = async (id) => {
    const ok = await confirm({
      title: 'Excluir chamado', confirmText: 'Excluir', danger: true,
      message: 'Tem certeza? O chamado e todos os registros serão excluídos.',
    })
    if (!ok) return
    const { error } = await supabase.from('tickets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id).is('deleted_at', null)
    if (error) { showToast('Erro: ' + error.message, 'danger'); return }
    audit.deleted('tickets', id)
    showToast('Chamado excluído.', 'success')
    setDetailId(null)
    await load()
  }

  if (!tickets) return <SkeletonTable />

  const detailTicket = detailId ? (tickets.find(t => t.id === detailId) || null) : null

  return (
    <>
      {/* Header */}
      <div className="view-header">
        <div>
          <h2>Workflow de Atendimento</h2>
          <p>Gestão de ordens de serviço e chamados técnicos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button className="btn-primary" style={{ background: '#6366f1' }} onClick={() => setPriorityOpen(true)}>
              <Settings size={14} /> Prioridade das Salas
            </button>
          )}
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Abrir Chamado
          </button>
        </div>
      </div>

      {/* Stats (só para técnicos e admins) */}
      {isTech && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Aguardando na BASE', value: baseTickets.length, color: '#dc2626' },
            { label: 'Em Atendimento',     value: activeTickets.length, color: '#d97706' },
            { label: 'Finalizados hoje',   value: doneToday, color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 10, padding: '14px 20px', flex: 1, minWidth: 130,
            }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="kanban-tabs" style={{ marginBottom: 16 }}>
        <button className={`kanban-tab${view === 'base' ? ' active' : ''}`} onClick={() => setView('base')}>
          BASE <span style={{ opacity: 0.6 }}>({baseTickets.length})</span>
        </button>
        <button className={`kanban-tab${view === 'em_atendimento' ? ' active' : ''}`} onClick={() => setView('em_atendimento')}>
          Em Atendimento <span style={{ opacity: 0.6 }}>({activeTickets.length})</span>
        </button>
        <button className={`kanban-tab${view === 'finalizados' ? ' active' : ''}`} onClick={() => setView('finalizados')}>
          Finalizados
        </button>
      </div>

      {/* ── BASE ── */}
      {view === 'base' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {baseTickets.length === 0
            ? <EmptyState message="Nenhum chamado aguardando na BASE." />
            : baseTickets.map(t => (
              <BaseCard
                key={t.id}
                ticket={t}
                isTech={isTech}
                onInicializar={() => inicializar(t.id)}
                onDetail={() => setDetailId(t.id)}
              />
            ))
          }
        </div>
      )}

      {/* ── EM ATENDIMENTO ── */}
      {view === 'em_atendimento' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeTickets.length === 0
            ? <EmptyState message="Nenhuma OS em andamento." />
            : activeTickets.map(t => (
              <ActiveCard
                key={t.id}
                ticket={t}
                isAdmin={isAdmin}
                currentUserId={user?.id}
                onDetail={() => setDetailId(t.id)}
              />
            ))
          }
        </div>
      )}

      {/* ── FINALIZADOS ── */}
      {view === 'finalizados' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {doneTickets.length === 0
            ? <EmptyState message="Nenhuma OS finalizada." />
            : doneTickets.map(t => (
              <DoneCard key={t.id} ticket={t} onDetail={() => setDetailId(t.id)} />
            ))
          }
        </div>
      )}

      {/* ── Modais ── */}
      {createOpen && (
        <CreateTicketModal
          rooms={rooms}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => { setCreateOpen(false); await load() }}
        />
      )}

      {detailTicket && (
        <OSDetailModal
          ticket={detailTicket}
          currentUser={user}
          isTech={isTech}
          isAdmin={isAdmin}
          techs={techs.filter(t => t.id !== user?.id)}
          onClose={() => setDetailId(null)}
          onFinalizar={finalizar}
          onRepassar={repassar}
          onAddRecord={addRecord}
          onDelete={deleteTicket}
          onInicializar={inicializar}
        />
      )}

      {priorityOpen && (
        <RoomPriorityModal
          rooms={rooms}
          onClose={() => setPriorityOpen(false)}
          onSaved={async () => {
            setPriorityOpen(false)
            setRooms(await roomsFetcher())
            await load()
          }}
        />
      )}
    </>
  )
}

// ─── Card: BASE ───────────────────────────────────────────────────────────────
function BaseCard({ ticket, isTech, onInicializar, onDetail }) {
  const level = ticket.room?.priority_level || 1
  const p = ROOM_PRIORITY[level]
  return (
    <div
      style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px',
        border: `1.5px solid ${p.border}`, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'box-shadow .15s',
      }}
      onClick={onDetail}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <PriorityBadge level={level} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={11} /> {ticket.room?.name || '—'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} /> {timeAgo(ticket.created_at)}
          </span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <User size={11} /> {ticket.requester?.full_name || '—'}
        </div>
      </div>
      {isTech && (
        <button
          className="btn-primary"
          style={{ flexShrink: 0, background: '#059669', whiteSpace: 'nowrap' }}
          onClick={e => { e.stopPropagation(); onInicializar() }}
        >
          <Play size={13} /> Inicializar
        </button>
      )}
      {!isTech && <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
    </div>
  )
}

// ─── Card: EM ATENDIMENTO ─────────────────────────────────────────────────────
function ActiveCard({ ticket, isAdmin, currentUserId, onDetail }) {
  const level = ticket.room?.priority_level || 1
  const isOwner = ticket.assigned_to === currentUserId
  return (
    <div
      style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px',
        borderLeft: '4px solid var(--warning-color)', border: '1.5px solid var(--warning-color)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
      }}
      onClick={onDetail}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <PriorityBadge level={level} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={11} /> {ticket.room?.name || '—'}
          </span>
          {(isAdmin || !isOwner) && (
            <span style={{ fontSize: 12, color: '#d97706', display: 'flex', alignItems: 'center', gap: 3 }}>
              <User size={11} /> {ticket.assignee?.full_name || '—'}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} /> iniciado há {timeAgo(ticket.started_at)}
          </span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Solicitante: {ticket.requester?.full_name || '—'}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
    </div>
  )
}

// ─── Card: FINALIZADO ─────────────────────────────────────────────────────────
function DoneCard({ ticket, onDetail }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: '12px 16px',
        border: '1px solid var(--border-color)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14, opacity: 0.9,
      }}
      onClick={onDetail}
    >
      <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {ticket.room?.name || '—'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} /> {ticket.assignee?.full_name || '—'}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
        {ticket.finished_at ? new Date(ticket.finished_at).toLocaleDateString('pt-BR') : '—'}
      </span>
    </div>
  )
}

// ─── Modal: Abrir Chamado ─────────────────────────────────────────────────────
function CreateTicketModal({ rooms, onClose, onCreated }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const audit = useAudit()
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [roomId, setRoomId] = useState('')

  const roomsSorted = [...rooms].sort((a, b) => {
    const diff = (b.priority_level || 1) - (a.priority_level || 1)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })

  const handle = async e => {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.from('tickets')
      .insert([{ title: title.trim(), description: desc.trim(), room_id: roomId, requester_id: user.id, status: 'aberto' }])
      .select('id').single()
    if (error) { showToast('Erro: ' + error.message, 'danger'); setBusy(false); return }
    audit.created('tickets', data?.id, { title: title.trim() })
    showToast('Chamado aberto na BASE!', 'success')
    onCreated()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Abrir Chamado</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handle}>
          <div className="form-group">
            <label>Título / Resumo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input type="text" className="form-control" required placeholder="Ex: Projetor não liga"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Descrição completa <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <textarea className="form-control" required rows={4}
              placeholder="Detalhe o problema, o que já foi tentado, etc."
              value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Local / Sala <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <select className="form-control" required value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value="">Selecione a sala...</option>
              {roomsSorted.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}{(r.priority_level || 1) >= 3 ? ' 🔴' : (r.priority_level || 1) >= 2 ? ' 🟡' : ''}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              🔴 Crítica · 🟡 Alta — a prioridade é definida pela sala.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Enviar Chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Detalhe / OS ──────────────────────────────────────────────────────
function OSDetailModal({ ticket, currentUser, isTech, isAdmin, techs, onClose, onFinalizar, onRepassar, onAddRecord, onDelete, onInicializar }) {
  const [records, setRecords]         = useState(null)
  const [newRecord, setNewRecord]     = useState('')
  const [sendingRecord, setSendingRecord] = useState(false)
  const [repassarOpen, setRepassarOpen]   = useState(false)
  const [finalizarOpen, setFinalizarOpen] = useState(false)
  const [conclusion, setConclusion]   = useState('')
  const [finalizingBusy, setFinalizingBusy] = useState(false)

  const isOwner  = ticket.assigned_to === currentUser?.id
  const canAct   = (isTech && isOwner) || isAdmin
  const isActive = ticket.status === 'em_atendimento'
  const isBase   = ticket.status === 'aberto' && !ticket.assigned_to

  const loadRecords = useCallback(async () => {
    const { data } = await supabase
      .from('ticket_records')
      .select('*, author:profiles(full_name)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
    setRecords(data || [])
  }, [ticket.id])

  useEffect(() => { loadRecords() }, [loadRecords])
  useRealtime('ticket_records', useCallback(() => loadRecords(), [loadRecords]))

  const submitRecord = async e => {
    e.preventDefault()
    if (!newRecord.trim()) return
    setSendingRecord(true)
    const ok = await onAddRecord(ticket.id, newRecord)
    if (ok) { setNewRecord(''); await loadRecords() }
    setSendingRecord(false)
  }

  const handleFinalizar = async () => {
    setFinalizingBusy(true)
    await onFinalizar(ticket.id, conclusion)
    setFinalizingBusy(false)
  }

  const level = ticket.room?.priority_level || 1

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PriorityBadge level={level} />
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: isBase ? 'rgba(100,116,139,.1)' : isActive ? 'rgba(217,119,6,.1)' : 'rgba(5,150,105,.1)',
              color: isBase ? '#64748b' : isActive ? '#d97706' : '#059669',
            }}>
              {isBase ? 'BASE' : isActive ? 'Em Atendimento' : 'Finalizado'}
            </span>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Título e info */}
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--primary-color)', margin: '12px 0 8px' }}>
          {ticket.title}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
          {ticket.description}
        </p>

        {/* Meta */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))',
          gap: 10, background: 'var(--bg-main)', borderRadius: 10, padding: 14, marginBottom: 20,
        }}>
          {[
            { label: 'Local', value: ticket.room?.name },
            { label: 'Solicitante', value: ticket.requester?.full_name },
            { label: 'Técnico', value: ticket.assignee?.full_name || (isBase ? 'Aguardando' : '—') },
            { label: 'Aberto em', value: new Date(ticket.created_at).toLocaleDateString('pt-BR') },
            ticket.started_at && { label: 'Início atend.', value: fmtDateTime(ticket.started_at) },
            ticket.finished_at && { label: 'Finalizado em', value: fmtDateTime(ticket.finished_at) },
          ].filter(Boolean).map(m => (
            <div key={m.label}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Registros / Timeline */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-secondary)', marginBottom: 10 }}>
            Registros
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
            {!records ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
            ) : records.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum registro ainda.</div>
            ) : records.map(r => (
              <RecordItem key={r.id} record={r} currentUserId={currentUser?.id} />
            ))}
          </div>
        </div>

        {/* Adicionar registro (se active e canAct) */}
        {isActive && canAct && !repassarOpen && !finalizarOpen && (
          <form onSubmit={submitRecord} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text" className="form-control"
              placeholder="Adicionar registro ou comentário..."
              value={newRecord} onChange={e => setNewRecord(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ flexShrink: 0 }} disabled={sendingRecord || !newRecord.trim()}>
              {sendingRecord ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            </button>
          </form>
        )}

        {/* Painel Repassar */}
        {repassarOpen && (
          <RepassarPanel
            techs={techs}
            onRepassar={async (techId, techName) => {
              const ok = await onRepassar(ticket.id, techId, techName)
              if (ok) { setRepassarOpen(false); onClose() }
            }}
            onCancel={() => setRepassarOpen(false)}
          />
        )}

        {/* Painel Finalizar */}
        {finalizarOpen && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '.5px' }}>
              Conclusão do Atendimento
            </div>
            <textarea
              className="form-control" rows={3}
              placeholder="Descreva o que foi feito para resolver o problema..."
              value={conclusion} onChange={e => setConclusion(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569', flex: 1 }}
                onClick={() => setFinalizarOpen(false)}>Voltar</button>
              <button className="btn-primary" style={{ background: '#059669', flex: 1 }}
                onClick={handleFinalizar} disabled={finalizingBusy}>
                {finalizingBusy ? <Loader2 size={14} className="spin" /> : <><CheckCircle2 size={14} /> Confirmar Finalização</>}
              </button>
            </div>
          </div>
        )}

        {/* Botões de ação */}
        {!repassarOpen && !finalizarOpen && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
            {/* Inicializar se estiver na BASE */}
            {isBase && isTech && (
              <button className="btn-primary" style={{ background: '#059669', flex: 1 }}
                onClick={() => { onInicializar(ticket.id); onClose() }}>
                <Play size={14} /> Inicializar OS
              </button>
            )}
            {/* Ações de OS ativa */}
            {isActive && canAct && (
              <>
                <button className="btn-primary" style={{ background: '#6366f1', flex: 1 }}
                  onClick={() => setRepassarOpen(true)}>
                  <ArrowRightLeft size={14} /> Repassar
                </button>
                <button className="btn-primary" style={{ background: '#059669', flex: 1 }}
                  onClick={() => setFinalizarOpen(true)}>
                  <CheckCircle2 size={14} /> Finalizar OS
                </button>
              </>
            )}
            {isAdmin && (
              <button className="btn-primary" style={{ background: 'var(--danger-color)', flex: 1 }}
                onClick={() => onDelete(ticket.id)}>
                <Trash2 size={14} /> Excluir
              </button>
            )}
            {!isBase && !isActive && !isAdmin && (
              <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569', flex: 1 }}
                onClick={onClose}>Fechar</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Item de registro no timeline ─────────────────────────────────────────────
function RecordItem({ record, currentUserId }) {
  const isSystem     = record.type === 'system'
  const isConclusion = record.type === 'conclusion'
  const isOwn        = record.author_id === currentUserId

  if (isSystem) {
    return (
      <div style={{
        fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center',
        padding: '4px 0', borderBottom: '1px dashed var(--border-color)',
      }}>
        {record.content} · {new Date(record.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    )
  }

  return (
    <div style={{
      background: isConclusion ? 'rgba(5,150,105,.08)' : isOwn ? 'rgba(99,102,241,.07)' : 'var(--bg-main)',
      border: isConclusion ? '1px solid rgba(5,150,105,.2)' : '1px solid transparent',
      borderRadius: 8, padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: isOwn ? '#6366f1' : 'var(--text-secondary)' }}>
          {isConclusion ? '✅ Conclusão — ' : ''}{record.author?.full_name || '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
          {fmtDateTime(record.created_at)}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{record.content}</p>
    </div>
  )
}

// ─── Painel Repassar ──────────────────────────────────────────────────────────
function RepassarPanel({ techs, onRepassar, onCancel }) {
  const [selectedId, setSelectedId] = useState('')
  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginBottom: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '.5px' }}>
        Repassar OS para
      </div>
      <select className="form-control" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
        <option value="">Selecione o técnico...</option>
        {techs.map(t => (
          <option key={t.id} value={t.id}>{t.full_name} ({t.role === 'admin' ? 'Admin' : 'Técnico'})</option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569', flex: 1 }} onClick={onCancel}>Voltar</button>
        <button className="btn-primary" style={{ flex: 1 }} disabled={!selectedId}
          onClick={() => {
            const tech = techs.find(t => t.id === selectedId)
            if (tech) onRepassar(tech.id, tech.full_name)
          }}>
          <ArrowRightLeft size={14} /> Confirmar Repasse
        </button>
      </div>
    </div>
  )
}

// ─── Modal: Prioridade das Salas ──────────────────────────────────────────────
function RoomPriorityModal({ rooms, onClose, onSaved }) {
  const { showToast } = useToast()
  const [levels, setLevels]   = useState(() => Object.fromEntries(rooms.map(r => [r.id, r.priority_level || 1])))
  const [busy, setBusy]       = useState(false)

  const save = async () => {
    setBusy(true)
    const updates = rooms.map(r =>
      supabase.from('rooms').update({ priority_level: levels[r.id] || 1 }).eq('id', r.id),
    )
    const results = await Promise.all(updates)
    const anyError = results.find(r => r.error)
    if (anyError) {
      showToast('Erro ao salvar: ' + anyError.error.message, 'danger')
      setBusy(false)
      return
    }
    showToast('Prioridades salvas!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h3>Prioridade das Salas</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Define a urgência automática dos chamados por local.
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
          {[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--bg-main)', borderRadius: 8, padding: '10px 14px',
              border: `1.5px solid ${ROOM_PRIORITY[levels[r.id] || 1].border}`,
            }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{r.name}</span>
              <PriorityBadge level={levels[r.id] || 1} />
              <select
                className="form-control filter-control"
                style={{ width: 110, flexShrink: 0 }}
                value={levels[r.id] || 1}
                onChange={e => setLevels(prev => ({ ...prev, [r.id]: Number(e.target.value) }))}
              >
                <option value={1}>Normal</option>
                <option value={2}>Alta</option>
                <option value={3}>Crítica</option>
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : 'Salvar Prioridades'}
          </button>
        </div>
      </div>
    </div>
  )
}
