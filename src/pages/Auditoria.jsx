import { useEffect, useState } from 'react'
import { X, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { Pagination } from '../components/Pagination.jsx'
import { fmtDateTime } from '../utils/format.js'

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
  const { profiles: profilesFetcher } = useStore()
  const { showToast } = useToast()
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
                  <th style={{ width: 90 }}>Detalhes</th>
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
                        {log.details && (
                          <button
                            className="btn-table-action edit"
                            style={{ padding: '3px 10px', fontSize: 12 }}
                            onClick={() => setDetailLog(log)}
                          >
                            Ver
                          </button>
                        )}
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
