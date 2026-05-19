import { useEffect, useState } from 'react'
import { X, Lock, Eye, Undo2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { Pagination } from '../components/Pagination.jsx'
import { fmtDateTime } from '../utils/format.js'

// Tabelas que suportam soft-delete e podem ter registros restaurados
const RESTORABLE = new Set(['rooms', 'equipment', 'asset_movements', 'tickets', 'profiles'])

const ACTIONS = [
  { value: 'create', label: 'Criação' },
  { value: 'update', label: 'Edição' },
  { value: 'delete', label: 'Exclusão' },
  { value: 'restore', label: 'Restauração' },
  { value: 'import', label: 'Importação' },
  { value: 'batch_movement', label: 'Movimentação em Lote' },
  { value: 'password_reset', label: 'Redefinição de Senha' },
]

const TABLE_LABELS = {
  rooms: 'Salas',
  equipment: 'Equipamentos',
  asset_movements: 'Movimentações',
  tickets: 'Chamados',
  profiles: 'Usuários',
  audit_logs: 'Auditoria',
}

const PAGE_SIZE = 50

function buildQuery(filters, { page, count = false }) {
  let q = supabase.from('audit_logs').select('*', count ? { count: 'exact' } : {})
  if (filters.actorId) q = q.eq('actor_id', filters.actorId)
  if (filters.action) q = q.eq('action', filters.action)
  if (filters.table) q = q.eq('table_name', filters.table)
  if (filters.dateFrom)
    q = q.gte('created_at', new Date(filters.dateFrom + 'T00:00:00').toISOString())
  if (filters.dateTo)
    q = q.lte('created_at', new Date(filters.dateTo + 'T23:59:59').toISOString())
  q = q.order('created_at', { ascending: false })
  const from = (page - 1) * PAGE_SIZE
  return q.range(from, from + PAGE_SIZE - 1)
}

export function Auditoria() {
  const { user } = useAuth()
  const { profiles: profilesFetcher, invalidate } = useStore()
  const { showToast, confirm } = useToast()
  const audit = useAudit()
  const [data, setData] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [profiles, setProfiles] = useState([])
  const [filters, setFilters] = useState({
    actorId: '',
    action: '',
    table: '',
    dateFrom: '',
    dateTo: '',
  })
  const [detailLog, setDetailLog] = useState(null)
  const [undoLog, setUndoLog] = useState(null)
  const [undoBusy, setUndoBusy] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    profilesFetcher().then(setProfiles)
  }, [profilesFetcher])

  const fetchPage = async (p, currentFilters = filters) => {
    setData(null)
    const { data: rows, count, error } = await buildQuery(currentFilters, {
      page: p,
      count: true,
    })
    if (error) {
      showToast('Erro ao carregar logs: ' + error.message, 'danger')
      setData([])
      return
    }
    setData(rows || [])
    setTotal(count || 0)
  }

  useEffect(() => {
    if (!isAdmin) return
    fetchPage(1)
  }, [isAdmin])

  const applyFilters = () => {
    setPage(1)
    fetchPage(1, filters)
  }

  const clearFilters = () => {
    const cleared = { actorId: '', action: '', table: '', dateFrom: '', dateTo: '' }
    setFilters(cleared)
    setPage(1)
    fetchPage(1, cleared)
  }

  const onPrev = () => {
    const p = page - 1
    setPage(p)
    fetchPage(p)
    window.scrollTo(0, 0)
  }

  const onNext = () => {
    const p = page + 1
    setPage(p)
    fetchPage(p)
    window.scrollTo(0, 0)
  }

  const executeUndo = async (log) => {
    setUndoBusy(true)
    const isDelete = log.action === 'delete'
    const isCreate = log.action === 'create'

    if (isDelete) {
      // Restaura o registro removendo o deleted_at
      const { error } = await supabase
        .from(log.table_name)
        .update({ deleted_at: null })
        .eq('id', log.record_id)
      if (error) {
        showToast('Erro ao restaurar: ' + error.message, 'danger')
        setUndoBusy(false)
        return
      }
      audit.restored(log.table_name, log.record_id, { undone_log_id: log.id })
      showToast(`${TABLE_LABELS[log.table_name] || 'Registro'} restaurado com sucesso.`, 'success')
    } else if (isCreate) {
      // Reverte a criação fazendo soft-delete do registro
      const { error } = await supabase
        .from(log.table_name)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', log.record_id)
        .is('deleted_at', null)
      if (error) {
        showToast('Erro ao reverter: ' + error.message, 'danger')
        setUndoBusy(false)
        return
      }
      audit.deleted(log.table_name, log.record_id, { undone_log_id: log.id })
      showToast(`Criação de ${TABLE_LABELS[log.table_name] || 'registro'} revertida.`, 'success')
    }

    // Invalida caches relevantes
    if (log.table_name === 'rooms') invalidate('rooms', 'roomsFull')
    else if (log.table_name === 'equipment') invalidate('equipment')
    else if (log.table_name === 'profiles') invalidate('profiles')

    setUndoBusy(false)
    setUndoLog(null)
    fetchPage(page)
  }

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <Lock size={48} style={{ color: 'var(--text-secondary)', opacity: 0.4, display: 'block', margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 8px' }}>Acesso restrito</h3>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Esta seção é visível apenas para administradores.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Auditoria</h2>
          <p>Registro de todas as ações realizadas no sistema.</p>
        </div>
      </div>

      <div className="filter-bar fade-in">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 2 }}>
            <label className="filter-label">Usuário</label>
            <select
              className="form-control filter-control"
              value={filters.actorId}
              onChange={(e) => setFilters((f) => ({ ...f, actorId: e.target.value }))}
            >
              <option value="">Todos</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.id}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Ação</label>
            <select
              className="form-control filter-control"
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            >
              <option value="">Todas</option>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Tabela</label>
            <select
              className="form-control filter-control"
              value={filters.table}
              onChange={(e) => setFilters((f) => ({ ...f, table: e.target.value }))}
            >
              <option value="">Todas</option>
              {Object.entries(TABLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">De</label>
            <input
              type="date"
              className="form-control filter-control"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Até</label>
            <input
              type="date"
              className="form-control filter-control"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
        </div>
        <div className="filter-actions">
          <span className="filter-count">
            {total} registro{total !== 1 ? 's' : ''}
          </span>
          <button className="btn-filter-clear" onClick={clearFilters}>
            <X size={13} /> Limpar
          </button>
          <button className="btn-primary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={applyFilters}>
            Filtrar
          </button>
        </div>
      </div>

      {!data ? (
        <SkeletonTable />
      ) : (
        <>
          <div className="table-card fade-in">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Tabela</th>
                  <th>ID do Registro</th>
                  <th style={{ width: 110 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                      Nenhum log encontrado.
                    </td>
                  </tr>
                ) : (
                  data.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {fmtDateTime(log.created_at)}
                      </td>
                      <td>
                        <strong>{log.actor_name || '—'}</strong>
                      </td>
                      <td>
                        <ActionBadge action={log.action} />
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {TABLE_LABELS[log.table_name] || log.table_name || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'monospace' }}>
                        {log.record_id ? log.record_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td>
                        <div className="table-actions">
                          {log.details && (
                            <button
                              className="btn-table-action edit"
                              onClick={() => setDetailLog(log)}
                              title="Ver detalhes"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {(log.action === 'delete' || log.action === 'create') && RESTORABLE.has(log.table_name) && log.record_id && (
                            <button
                              className="btn-table-action restore"
                              onClick={() => setUndoLog(log)}
                              title={log.action === 'delete' ? 'Restaurar registro' : 'Reverter criação'}
                            >
                              {log.action === 'delete' ? <Undo2 size={14} /> : <RotateCcw size={14} />}
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
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onPrev={onPrev}
            onNext={onNext}
          />
        </>
      )}

      {detailLog && <DetailModal log={detailLog} onClose={() => setDetailLog(null)} />}
      {undoLog && (
        <UndoModal
          log={undoLog}
          busy={undoBusy}
          onConfirm={() => executeUndo(undoLog)}
          onClose={() => setUndoLog(null)}
        />
      )}
    </>
  )
}

function ActionBadge({ action }) {
  const map = {
    create: { bg: 'rgba(16,185,129,.12)', color: '#059669', label: 'Criação' },
    update: { bg: 'rgba(245,158,11,.12)', color: '#d97706', label: 'Edição' },
    delete: { bg: 'rgba(239,68,68,.12)', color: '#dc2626', label: 'Exclusão' },
    restore: { bg: 'rgba(99,102,241,.12)', color: '#6366f1', label: 'Restauração' },
    import: { bg: 'rgba(59,130,246,.12)', color: '#2563eb', label: 'Importação' },
    batch_movement: { bg: 'rgba(16,185,129,.12)', color: '#059669', label: 'Lote' },
    password_reset: { bg: 'rgba(245,158,11,.12)', color: '#d97706', label: 'Senha' },
  }
  const c = map[action] || { bg: 'rgba(0,0,0,.06)', color: 'var(--text-secondary)', label: action }
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {c.label}
    </span>
  )
}

function DetailModal({ log, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Detalhes do Log</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <Row label="Data" value={fmtDateTime(log.created_at)} />
          <Row label="Usuário" value={log.actor_name || log.actor_id || '—'} />
          <Row label="Ação" value={log.action} />
          <Row label="Tabela" value={TABLE_LABELS[log.table_name] || log.table_name || '—'} />
          <Row label="ID" value={log.record_id || '—'} mono />
        </div>
        {log.details && (
          <>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Dados adicionais</p>
            <pre
              style={{
                background: 'var(--bg-main)',
                borderRadius: 8,
                padding: 14,
                fontSize: 12,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--text-primary)',
              }}
            >
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// Campos que não precisam aparecer na prévia (são técnicos/internos)
const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])

// Labels legíveis por tabela
const FIELD_LABELS = {
  equipment: { name: 'Nome', categoria: 'Categoria', status: 'Estado', asset_number: 'Nº Patrimônio', serial_number: 'Nº Série', observacao: 'Observação' },
  rooms: { name: 'Nome', room_number: 'Número', coordinator: 'Coordenador', description: 'Descrição', priority_level: 'Prioridade' },
  asset_movements: { asset_number: 'Nº Patrimônio', serial_number: 'Nº Série', moved_at: 'Data da movimentação', received_by: 'Recebido por', origin_room: 'Sala de origem', destination_room: 'Sala de destino', moved_by_name: 'Movido por' },
  tickets: { title: 'Título', status: 'Status', description: 'Descrição', priority: 'Prioridade' },
  profiles: { full_name: 'Nome completo', email: 'E-mail', role: 'Papel' },
}

async function fetchFullRecord(tableName, recordId) {
  if (!recordId || !tableName) return null

  if (tableName === 'asset_movements') {
    const { data: mov } = await supabase.from('asset_movements').select('*').eq('id', recordId).maybeSingle()
    if (!mov) return null
    const roomIds = [mov.origin_room_id, mov.destination_room_id].filter(Boolean)
    const profileIds = [mov.moved_by].filter(Boolean)
    const [{ data: rooms }, { data: profiles }] = await Promise.all([
      roomIds.length ? supabase.from('rooms').select('id, name').in('id', roomIds) : { data: [] },
      profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds) : { data: [] },
    ])
    const roomMap = Object.fromEntries((rooms || []).map(r => [r.id, r.name]))
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))
    return {
      asset_number: mov.asset_number,
      serial_number: mov.serial_number,
      moved_at: mov.moved_at,
      origin_room: roomMap[mov.origin_room_id] || mov.origin_room_id || '—',
      destination_room: roomMap[mov.destination_room_id] || mov.destination_room_id || '—',
      moved_by_name: profileMap[mov.moved_by] || mov.moved_by || '—',
      received_by: mov.received_by,
    }
  }

  const { data } = await supabase.from(tableName).select('*').eq('id', recordId).maybeSingle()
  return data
}

function RecordPreview({ tableName, record }) {
  const labels = FIELD_LABELS[tableName] || {}
  const entries = Object.entries(record).filter(([k, v]) => {
    if (SKIP_FIELDS.has(k)) return false
    if (v === null || v === undefined || v === '') return false
    return true
  })

  if (entries.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sem dados adicionais.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(([key, value]) => {
        const label = labels[key] || key
        let display = value
        if (typeof value === 'boolean') display = value ? 'Sim' : 'Não'
        else if (key.endsWith('_at') && typeof value === 'string') display = fmtDateTime(value)
        else if (typeof value === 'object') display = JSON.stringify(value)
        else display = String(value)
        return (
          <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, minWidth: 130, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{display}</span>
          </div>
        )
      })}
    </div>
  )
}

function UndoModal({ log, busy, onConfirm, onClose }) {
  const isDelete = log.action === 'delete'
  const tableLabel = TABLE_LABELS[log.table_name] || log.table_name
  const [record, setRecord] = useState(null)
  const [loadingRecord, setLoadingRecord] = useState(true)

  useEffect(() => {
    fetchFullRecord(log.table_name, log.record_id).then(data => {
      setRecord(data)
      setLoadingRecord(false)
    })
  }, [log.table_name, log.record_id])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: isDelete ? 'rgba(99,102,241,.1)' : 'rgba(245,158,11,.1)', color: isDelete ? '#6366f1' : '#d97706', padding: 10, borderRadius: 10, flexShrink: 0 }}>
              {isDelete ? <Undo2 size={20} /> : <RotateCcw size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{isDelete ? 'Restaurar registro' : 'Reverter criação'}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {fmtDateTime(log.created_at)} · por <strong>{log.actor_name || '—'}</strong>
              </div>
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Registro completo */}
        <div style={{ background: 'var(--bg-main)', borderRadius: 10, padding: '14px 16px', margin: '14px 0', minHeight: 60 }}>
          <p style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 12px' }}>
            {tableLabel} — dados do registro
          </p>
          {loadingRecord ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
              <Loader2 size={14} className="spin" /> Carregando...
            </div>
          ) : record ? (
            <RecordPreview tableName={log.table_name} record={record} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Registro não encontrado — pode já ter sido restaurado ou permanentemente removido.
            </p>
          )}
        </div>

        {/* Aviso */}
        <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 20 }}>
          <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isDelete
              ? `O registro de ${tableLabel.toLowerCase()} será restaurado e voltará a aparecer no sistema.`
              : `O registro de ${tableLabel.toLowerCase()} será excluído novamente (soft-delete).`
            }
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            style={{ background: isDelete ? '#6366f1' : '#d97706' }}
            onClick={onConfirm}
            disabled={busy || loadingRecord}
          >
            {busy ? 'Aguarde…' : isDelete ? 'Restaurar' : 'Reverter criação'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, minWidth: 70 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}
