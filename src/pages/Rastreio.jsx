import { useEffect, useState, useMemo } from 'react'
import { X, FileSpreadsheet, History, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { formatAssetNumber, fmtDate, fmtDateTime } from '../utils/format.js'

const STATUS_MAP = {
  novo: { bg: 'rgba(16,185,129,.12)', color: '#059669' },
  bom: { bg: 'rgba(59,130,246,.12)', color: '#2563eb' },
  regular: { bg: 'rgba(245,158,11,.12)', color: '#d97706' },
  inservível: { bg: 'rgba(239,68,68,.12)', color: '#dc2626' },
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase()
  const c = STATUS_MAP[s] || { bg: 'rgba(0,0,0,.06)', color: 'var(--text-secondary)' }
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
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  )
}

export function Rastreio() {
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sort, setSort] = useState('az')
  const [historyEq, setHistoryEq] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [
        { data: movements, error },
        { data: rooms },
        { data: profilesList },
      ] = await Promise.all([
        supabase
          .from('asset_movements')
          .select(
            'equipment_id, equipment(name,categoria,status,observacao), asset_number, serial_number, received_by, moved_at, destination_room_id, moved_by',
          )
          .is('deleted_at', null)
          .order('moved_at', { ascending: false }),
        supabase.from('rooms').select('id, name').is('deleted_at', null),
        supabase.from('profiles').select('id, full_name').is('deleted_at', null),
      ])

      if (error) {
        showToast(error.message, 'danger')
        return
      }

      const roomMap = Object.fromEntries((rooms || []).map((r) => [r.id, r]))
      const profileMap = Object.fromEntries((profilesList || []).map((p) => [p.id, p]))

      const seen = new Set()
      const items = []
      ;(movements || []).forEach((m) => {
        const key = m.asset_number
          ? `pat_${m.asset_number}`
          : m.serial_number
            ? `eq_${m.equipment_id}_ser_${m.serial_number}`
            : `eq_${m.equipment_id}`
        if (seen.has(key)) return
        seen.add(key)
        if (!m.destination_room_id) return
        items.push({
          equipment_id: m.equipment_id,
          equipment: m.equipment,
          categoria: m.equipment?.categoria || null,
          status: m.equipment?.status || null,
          observacao: m.equipment?.observacao || null,
          asset_number: m.asset_number || null,
          serial_number: m.serial_number || null,
          received_by: m.received_by || null,
          moved_at: m.moved_at || null,
          destination_room_id: m.destination_room_id,
          moved_by: m.moved_by || null,
          room: roomMap[m.destination_room_id] || null,
          profile: profileMap[m.moved_by] || null,
        })
      })

      setData(items)
    }
    load()
  }, [])

  const uniqueRooms = useMemo(() => {
    if (!data) return []
    return Object.values(
      Object.fromEntries(
        data.filter((d) => d.room).map((d) => [d.destination_room_id, d.room]),
      ),
    ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [data])

  const categorias = useMemo(() => {
    if (!data) return []
    return [...new Set(data.filter((d) => d.categoria).map((d) => d.categoria))].sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = (search || '').toLowerCase().trim()

    let result = data.filter((d) => {
      if (filterRoom && d.destination_room_id !== filterRoom) return false
      if (filterCat && (d.categoria || '') !== filterCat) return false
      if (filterStatus && (d.status || '') !== filterStatus) return false
      if (q) {
        const hay = [
          d.equipment?.name || '',
          d.asset_number || '',
          d.serial_number || '',
          d.categoria || '',
          d.received_by || '',
          d.observacao || '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    if (sort === 'az')
      result.sort((a, b) =>
        (a.equipment?.name || '').localeCompare(b.equipment?.name || '', 'pt-BR'),
      )
    else if (sort === 'za')
      result.sort((a, b) =>
        (b.equipment?.name || '').localeCompare(a.equipment?.name || '', 'pt-BR'),
      )
    else if (sort === 'pat')
      result.sort((a, b) =>
        (a.asset_number || 'zzz').localeCompare(b.asset_number || 'zzz', 'pt-BR', {
          numeric: true,
        }),
      )
    else if (sort === 'sala')
      result.sort((a, b) =>
        (a.room?.name || 'zzz').localeCompare(b.room?.name || 'zzz', 'pt-BR'),
      )
    else if (sort === 'cat')
      result.sort((a, b) =>
        (a.categoria || 'zzz').localeCompare(b.categoria || 'zzz', 'pt-BR'),
      )

    return result
  }, [data, search, filterRoom, filterCat, filterStatus, sort])

  const exportExcel = async () => {
    if (filtered.length === 0) {
      showToast('Nenhum equipamento para exportar.', 'warning')
      return
    }
    const XLSX = (await import('xlsx')).default
    const wsData = [
      ['Equipamento', 'Categoria', 'Status', 'Nº Patrimônio', 'Nº Série', 'Localização Atual', 'Com quem está', 'Última Movimentação', 'Observação'],
      ...filtered.map((d) => [
        d.equipment?.name || '—',
        d.categoria || '—',
        d.status || '—',
        formatAssetNumber(d.asset_number) || '—',
        d.serial_number || '—',
        d.room?.name || 'Não localizado',
        d.received_by || '—',
        d.moved_at ? new Date(d.moved_at).toLocaleString('pt-BR') : 'Nunca movimentado',
        d.observacao || '—',
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [
      { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
      { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 30 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rastreio')
    XLSX.writeFile(wb, `rastreio_${new Date().toISOString().slice(0, 10)}.xlsx`)
    showToast('Arquivo exportado!', 'success')
  }

  const clearFilters = () => {
    setSearch('')
    setFilterRoom('')
    setFilterCat('')
    setFilterStatus('')
    setSort('az')
  }

  if (!data) return <SkeletonTable />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Rastreio de Patrimônio</h2>
          <p>Localização atual de cada equipamento individual no sistema.</p>
        </div>
        <button className="btn-primary" style={{ background: '#059669' }} onClick={exportExcel}>
          <FileSpreadsheet size={14} /> Exportar Excel
        </button>
      </div>

      <div className="filter-bar fade-in">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 2, minWidth: 180 }}>
            <label className="filter-label">Pesquisar</label>
            <input
              type="text"
              className="form-control filter-control"
              placeholder="Nome, patrimônio, série..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Sala</label>
            <select
              className="form-control filter-control"
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
            >
              <option value="">Todas</option>
              {uniqueRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Categoria</label>
            <select
              className="form-control filter-control"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              className="form-control filter-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {['novo', 'bom', 'regular', 'inservível'].map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Ordenar por</label>
            <select
              className="form-control filter-control"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="az">Nome (A–Z)</option>
              <option value="za">Nome (Z–A)</option>
              <option value="pat">Nº Patrimônio</option>
              <option value="sala">Sala</option>
              <option value="cat">Categoria</option>
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <span className="filter-count">
            {filtered.length} equipamento{filtered.length !== 1 ? 's' : ''}
          </span>
          <button className="btn-filter-clear" onClick={clearFilters}>
            <X size={13} /> Limpar
          </button>
        </div>
      </div>

      <div className="table-card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Equipamento</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Nº Patrimônio</th>
              <th>Localização Atual</th>
              <th>Com quem está</th>
              <th>Última Mov.</th>
              <th style={{ width: 80 }}>Histórico</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}
                >
                  Nenhum equipamento encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((d, i) => (
                <tr key={i}>
                  <td>
                    <strong>{d.equipment?.name || '—'}</strong>
                    {d.serial_number && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Série: {d.serial_number}
                      </div>
                    )}
                  </td>
                  <td>
                    {d.categoria ? (
                      <span
                        style={{
                          background: 'rgba(99,102,241,.1)',
                          color: '#6366f1',
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {d.categoria}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {formatAssetNumber(d.asset_number) || '—'}
                  </td>
                  <td>
                    {d.room ? (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--accent-color)',
                        }}
                      >
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        {d.room.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Não localizado</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{d.received_by || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {d.moved_at ? fmtDate(d.moved_at) : '—'}
                  </td>
                  <td>
                    <button
                      className="btn-table-action edit"
                      onClick={() => setHistoryEq(d)}
                      title="Ver histórico"
                    >
                      <History size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {historyEq && (
        <HistoryModal item={historyEq} onClose={() => setHistoryEq(null)} />
      )}
    </>
  )
}

function HistoryModal({ item, onClose }) {
  const { showToast } = useToast()
  const [movements, setMovements] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('asset_movements')
        .select(
          '*, origin_room:origin_room_id(name), destination_room:destination_room_id(name), profile:moved_by(full_name)',
        )
        .eq('equipment_id', item.equipment_id)
        .is('deleted_at', null)
        .order('moved_at', { ascending: false })
      if (error) {
        showToast('Erro ao carregar histórico.', 'danger')
        return
      }
      setMovements(data || [])
    }
    load()
  }, [item.equipment_id])

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
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="data-table" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Nº Pat.</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Responsável</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {formatAssetNumber(m.asset_number) || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {m.origin_room?.name || '—'}
                    </td>
                    <td style={{ color: 'var(--accent-color)' }}>
                      {m.destination_room?.name || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {m.profile?.full_name || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtDateTime(m.moved_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
