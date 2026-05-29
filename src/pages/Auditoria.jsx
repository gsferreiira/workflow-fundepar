import { useEffect, useState } from 'react'
import { X, Lock, Eye, Undo2, RotateCcw, AlertTriangle, Loader2, ArrowRightLeft } from 'lucide-react'
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
  { value: 'bulk_move', label: 'Bulk Move (Rastreio)' },
  { value: 'bulk_revert', label: 'Reversão de Lote' },
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

  // Reverte bulk_move ou batch_movement: cria movimentações inversas e soft-deleta as originais
  const executeBulkRevert = async (log) => {
    const movementIds = log.details?.movement_ids
    let originalMovs

    if (movementIds && movementIds.length > 0) {
      // Caminho novo: IDs estão salvos no log
      const { data, error: fetchError } = await supabase
        .from('asset_movements')
        .select('*')
        .in('id', movementIds)
        .is('deleted_at', null)

      if (fetchError) {
        showToast('Erro ao buscar movimentações: ' + fetchError.message, 'danger')
        setUndoBusy(false)
        return
      }
      originalMovs = data
    } else {
      // Caminho legado: log antigo sem IDs — busca por ator + destino + janela de tempo
      const logTime = new Date(log.created_at)
      const windowStart = new Date(logTime.getTime() - 10 * 60 * 1000).toISOString() // −10 min
      const windowEnd   = new Date(logTime.getTime() + 10 * 60 * 1000).toISOString() // +10 min

      // Resolve nome da sala → ID
      let destRoomId = null
      const destName = log.details?.destination || log.details?.to
      if (destName) {
        const { data: rooms } = await supabase
          .from('rooms')
          .select('id, name')
          .ilike('name', destName.trim())
          .limit(1)
        destRoomId = rooms?.[0]?.id || null
      }

      let query = supabase
        .from('asset_movements')
        .select('*')
        .eq('moved_by', log.actor_id)
        .gte('moved_at', windowStart)
        .lte('moved_at', windowEnd)
        .is('deleted_at', null)

      if (destRoomId) query = query.eq('destination_room_id', destRoomId)

      const { data, error: fetchError } = await query
      if (fetchError) {
        showToast('Erro ao buscar movimentações: ' + fetchError.message, 'danger')
        setUndoBusy(false)
        return
      }
      originalMovs = data
    }

    if (!originalMovs || originalMovs.length === 0) {
      showToast('Nenhuma movimentação encontrada para reverter — podem já ter sido revertidas ou excluídas.', 'warning')
      setUndoBusy(false)
      return
    }

    // 2. Cria movimentações inversas (troca origem ↔ destino)
    const movedAt = new Date().toISOString()
    const reverseMovs = originalMovs.map((m) => ({
      equipment_id: m.equipment_id,
      serial_number: m.serial_number,
      asset_number: m.asset_number,
      origin_room_id: m.destination_room_id,
      destination_room_id: m.origin_room_id,
      moved_by: user.id,
      received_by: null,
      moved_at: movedAt,
    }))

    const { error: insertError } = await supabase.from('asset_movements').insert(reverseMovs)
    if (insertError) {
      showToast('Erro ao criar movimentações inversas: ' + insertError.message, 'danger')
      setUndoBusy(false)
      return
    }

    // 3. Soft-delete das movimentações originais
    const { error: delError } = await supabase
      .from('asset_movements')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', movementIds)
      .is('deleted_at', null)

    if (delError) {
      showToast('Movimentações inversas criadas, mas erro ao excluir as originais: ' + delError.message, 'warning')
    }

    // 4. Atualiza equipment_locations para os itens com asset_number
    const locUpserts = reverseMovs
      .filter((m) => m.asset_number)
      .map((m) => ({
        equipment_id: m.equipment_id,
        asset_number: m.asset_number,
        serial_number: m.serial_number,
        current_room_id: m.destination_room_id,
        moved_by: user.id,
        received_by: null,
        moved_at: movedAt,
      }))
    if (locUpserts.length > 0) {
      await supabase.from('equipment_locations').upsert(locUpserts, { onConflict: 'asset_number' })
    }

    // 5. Loga a reversão
    audit.log('bulk_revert', 'asset_movements', null, {
      reverted_log_id: log.id,
      count: originalMovs.length,
      reverted_by: user.id,
    })

    showToast(
      `${originalMovs.length} movimentaç${originalMovs.length === 1 ? 'ão revertida' : 'ões revertidas'} com sucesso. Equipamentos voltaram às salas de origem.`,
      'success',
    )
    setUndoBusy(false)
    setUndoLog(null)
    fetchPage(page)
  }

  const executeUndo = async (log) => {
    setUndoBusy(true)

    if (log.action === 'bulk_move' || log.action === 'batch_movement') {
      await executeBulkRevert(log)
      return
    }

    const isDelete = log.action === 'delete'
    const isCreate = log.action === 'create'

    if (isDelete) {
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
                  <th>Detalhes</th>
                  <th style={{ width: 120 }}>Ações</th>
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
                  data.map((log) => {
                    const isBulk = log.action === 'bulk_move' || log.action === 'batch_movement'
                    const canRevertBulk = isBulk // mostra sempre; lida com logs antigos na execução
                    const canUndoRecord = (log.action === 'delete' || log.action === 'create') && RESTORABLE.has(log.table_name) && log.record_id
                    return (
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
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          {isBulk && log.details ? (
                            <span>
                              {log.details.count || '?'} item{log.details.count !== 1 ? 's' : ''}
                              {log.details.destination ? ` → ${log.details.destination}` : ''}
                              {log.details.from && log.details.to ? ` (${log.details.from} → ${log.details.to})` : ''}
                            </span>
                          ) : log.record_id ? (
                            <span style={{ fontFamily: 'monospace' }}>{log.record_id.slice(0, 8)}…</span>
                          ) : '—'}
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
                            {canRevertBulk && (
                              <button
                                className="btn-table-action restore"
                                onClick={() => setUndoLog(log)}
                                title="Reverter — desfaz o lote e retorna equipamentos às salas de origem"
                                style={{ color: '#6366f1' }}
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                            {canUndoRecord && (
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
                    )
                  })
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
    create:           { bg: 'rgba(16,185,129,.12)',  color: '#059669', label: 'Criação' },
    update:           { bg: 'rgba(245,158,11,.12)',  color: '#d97706', label: 'Edição' },
    delete:           { bg: 'rgba(239,68,68,.12)',   color: '#dc2626', label: 'Exclusão' },
    restore:          { bg: 'rgba(99,102,241,.12)',  color: '#6366f1', label: 'Restauração' },
    import:           { bg: 'rgba(59,130,246,.12)',  color: '#2563eb', label: 'Importação' },
    batch_movement:   { bg: 'rgba(16,185,129,.12)',  color: '#059669', label: 'Lote' },
    bulk_move:        { bg: 'rgba(14,165,233,.12)',  color: '#0284c7', label: 'Bulk Move' },
    bulk_revert:      { bg: 'rgba(245,158,11,.12)',  color: '#d97706', label: 'Reversão' },
    password_reset:   { bg: 'rgba(245,158,11,.12)',  color: '#d97706', label: 'Senha' },
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
          {log.record_id && <Row label="ID" value={log.record_id} mono />}
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

const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])

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
  const isBulk = log.action === 'bulk_move' || log.action === 'batch_movement'
  const isDelete = log.action === 'delete'
  const tableLabel = TABLE_LABELS[log.table_name] || log.table_name
  const [record, setRecord] = useState(null)
  const [loadingRecord, setLoadingRecord] = useState(!isBulk)

  useEffect(() => {
    if (isBulk) return
    fetchFullRecord(log.table_name, log.record_id).then(data => {
      setRecord(data)
      setLoadingRecord(false)
    })
  }, [log.table_name, log.record_id, isBulk])

  const count = log.details?.count || log.details?.movement_ids?.length || '?'
  const destination = log.details?.destination || log.details?.to || '—'
  const origin = log.details?.from || '—'
  const hasIds = (log.details?.movement_ids?.length || 0) > 0
  const isLegacyLog = isBulk && !hasIds

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(99,102,241,.1)', color: '#6366f1', padding: 10, borderRadius: 10, flexShrink: 0 }}>
              {isBulk ? <ArrowRightLeft size={20} /> : isDelete ? <Undo2 size={20} /> : <RotateCcw size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0 }}>
                {isBulk ? 'Reverter movimentação em lote' : isDelete ? 'Restaurar registro' : 'Reverter criação'}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {fmtDateTime(log.created_at)} · por <strong>{log.actor_name || '—'}</strong>
              </div>
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        {isBulk ? (
          // Vista de reversão de lote
          <>
            <div style={{ background: 'var(--bg-main)', borderRadius: 10, padding: '14px 16px', margin: '14px 0' }}>
              <p style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 12px' }}>
                Resumo do lote
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Row label="Qtd. itens" value={String(count)} />
                {log.action === 'bulk_move' && <Row label="Destino" value={destination} />}
                {log.action === 'batch_movement' && (
                  <>
                    <Row label="Origem" value={origin} />
                    <Row label="Destino" value={destination} />
                  </>
                )}
                <Row label="IDs gravados" value={hasIds ? `${log.details.movement_ids.length} ID(s)` : 'Não (log anterior à atualização) — busca por ator + sala + horário'} />
              </div>
            </div>

            <div style={{
              background: 'rgba(99,102,241,.06)',
              border: '1px solid rgba(99,102,241,.2)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              marginBottom: isLegacyLog ? 8 : 20,
            }}>
              <AlertTriangle size={14} style={{ color: '#6366f1', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {hasIds
                  ? `Isso criará ${count} movimentaç${count !== 1 ? 'ões inversas' : 'ão inversa'} devolvendo cada equipamento à sua sala de origem, e excluirá as movimentações originais.`
                  : `Log anterior à atualização — o sistema vai buscar automaticamente as movimentações desse usuário para a sala "${destination}" no horário do log (janela ±10 min) e revertê-las.`
                }
              </span>
            </div>
            {isLegacyLog && (
              <div style={{
                background: 'rgba(245,158,11,.08)',
                border: '1px solid rgba(245,158,11,.2)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                marginBottom: 20,
              }}>
                <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Confirme que não houve outra movimentação para essa mesma sala no mesmo período, para evitar reverter registros errados.
                </span>
              </div>
            )}
          </>
        ) : (
          // Vista de registro único
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
        )}

        {!isBulk && (
          <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 20 }}>
            <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isDelete
                ? `O registro de ${tableLabel.toLowerCase()} será restaurado e voltará a aparecer no sistema.`
                : `O registro de ${tableLabel.toLowerCase()} será excluído novamente (soft-delete).`
              }
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            style={{ background: '#6366f1' }}
            onClick={onConfirm}
            disabled={busy || loadingRecord}
          >
            {busy
              ? <><Loader2 size={14} className="spin" /> Revertendo...</>
              : isBulk
                ? `Reverter ${count} item${count !== 1 ? 's' : ''}`
                : isDelete ? 'Restaurar' : 'Reverter criação'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, minWidth: 100 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}
