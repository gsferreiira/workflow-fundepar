import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, MapPin, Package, FileSpreadsheet, RefreshCw, Download } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import { formatAssetNumber, fmtDateTime } from '../utils/format.js'

function normalize(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function MapaSalas() {
  const { showToast } = useToast()
  const [rooms, setRooms] = useState(null)
  const [search, setSearch] = useState('')
  const [detailRoom, setDetailRoom] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const refresh = useCallback(() => {
    setDetailRoom(null)
    setReloadToken((t) => t + 1)
  }, [])

  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

  useEffect(() => {
    setRooms(null)
    const load = async () => {
      const [{ data: roomList, error }, { data: movements }] = await Promise.all([
        supabase.from('rooms').select('*').is('deleted_at', null).order('name'),
        supabase
          .from('asset_movements')
          .select(
            'equipment_id, equipment(name), asset_number, serial_number, received_by, moved_at, destination_room_id',
          )
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })
          .limit(5000),
      ])

      if (error) {
        showToastRef.current(error.message, 'danger')
        return
      }

      const seen = new Set()
      const locationsByRoom = {}
      ;(movements || []).forEach((m) => {
        const key = m.asset_number
          ? `pat_${m.asset_number}`
          : m.serial_number
            ? `eq_${m.equipment_id}_ser_${m.serial_number}`
            : `eq_${m.equipment_id}`
        if (seen.has(key)) return
        seen.add(key)
        const rid = m.destination_room_id
        if (!rid) return
        if (!locationsByRoom[rid]) locationsByRoom[rid] = []
        locationsByRoom[rid].push({
          name: m.equipment?.name || '—',
          asset_number: m.asset_number || null,
          serial_number: m.serial_number || null,
          received_by: m.received_by || null,
          moved_at: m.moved_at || null,
        })
      })

      setRooms(
        (roomList || []).map((r) => ({
          ...r,
          items: locationsByRoom[r.id] || [],
        })),
      )
    }
    load()
  }, [reloadToken])

  const filtered = useMemo(() => {
    if (!rooms) return []
    const q = normalize(search).trim()
    if (!q) return rooms
    return rooms.filter((room) => {
      const people = [
        room.coordinator,
        ...(room.items || []).map((item) => item.received_by),
      ]
        .filter(Boolean)
        .join(' ')
      return [room.name, room.room_number, people].some((v) => normalize(v).includes(q))
    })
  }, [rooms, search])

  const exportRoom = async (room) => {
    try {
      if (room.items.length === 0) {
        showToast('Esta sala não tem equipamentos para exportar.', 'warning')
        return
      }
      const xlsxMod = await import('xlsx')
      const XLSX = xlsxMod.default && xlsxMod.default.utils ? xlsxMod.default : xlsxMod
      if (!XLSX?.utils?.book_new) {
        showToast('Biblioteca de exportação não carregada.', 'danger')
        return
      }
      const wsData = [
        ['Equipamento', 'Nº Patrimônio', 'Nº Série', 'Recebedor', 'Última Movimentação'],
        ...room.items.map((item) => [
          item.name || '—',
          formatAssetNumber(item.asset_number) || '—',
          item.serial_number || '—',
          item.received_by || '—',
          item.moved_at ? new Date(item.moved_at).toLocaleString('pt-BR') : '—',
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 22 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, room.name.slice(0, 31))
      const safeName = room.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
      XLSX.writeFile(wb, `sala_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
      showToast(`Exportado: ${room.items.length} equipamento${room.items.length !== 1 ? 's' : ''}`, 'success')
    } catch (err) {
      console.error('exportRoom erro:', err)
      showToast('Erro ao exportar: ' + (err?.message || 'falha inesperada'), 'danger')
    }
  }

  const exportAll = async () => {
    try {
      const allItems = (rooms || []).flatMap((r) =>
        r.items.map((item) => ({ ...item, room_name: r.name, room_number: r.room_number || '' })),
      )
      if (allItems.length === 0) {
        showToast('Nenhum equipamento para exportar.', 'warning')
        return
      }
      const xlsxMod = await import('xlsx')
      const XLSX = xlsxMod.default && xlsxMod.default.utils ? xlsxMod.default : xlsxMod
      if (!XLSX?.utils?.book_new) {
        showToast('Biblioteca de exportação não carregada.', 'danger')
        return
      }
      const wsData = [
        ['Sala', 'Nº Sala', 'Equipamento', 'Nº Patrimônio', 'Nº Série', 'Recebedor', 'Última Movimentação'],
        ...allItems.map((item) => [
          item.room_name || '—',
          item.room_number || '—',
          item.name || '—',
          formatAssetNumber(item.asset_number) || '—',
          item.serial_number || '—',
          item.received_by || '—',
          item.moved_at ? new Date(item.moved_at).toLocaleString('pt-BR') : '—',
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 22 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Mapa de Salas')
      XLSX.writeFile(wb, `mapa_salas_${new Date().toISOString().slice(0, 10)}.xlsx`)
      const roomsWithEquip = (rooms || []).filter((r) => r.items.length > 0).length
      showToast(`Exportado: ${allItems.length} equipamento${allItems.length !== 1 ? 's' : ''} em ${roomsWithEquip} sala${roomsWithEquip !== 1 ? 's' : ''}`, 'success')
    } catch (err) {
      console.error('exportAll erro:', err)
      showToast('Erro ao exportar: ' + (err?.message || 'falha inesperada'), 'danger')
    }
  }

  if (!rooms) return <SkeletonCards />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Mapa de Salas</h2>
          <p>Visualize os equipamentos alocados em cada ambiente.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-primary"
            style={{ background: '#059669' }}
            onClick={exportAll}
            disabled={!rooms || rooms.every((r) => r.items.length === 0)}
            title="Exportar todos os equipamentos de todas as salas"
          >
            <Download size={14} /> Exportar Tudo
          </button>
          <button
            className="btn-primary"
            style={{ background: '#64748b' }}
            onClick={refresh}
            title="Recarregar dados"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      <div className="filter-bar fade-in">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 1 }}>
            <label className="filter-label">Pesquisar sala, coordenador ou recebedor</label>
            <input
              type="text"
              className="form-control filter-control"
              placeholder="Digite para filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-actions">
          <span className="filter-count">
            {filtered.length} sala{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          Nenhuma sala encontrada{search ? ' para esse filtro' : ''}.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
          className="fade-in"
        >
          {filtered.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onDetail={() => setDetailRoom(room)}
            />
          ))}
        </div>
      )}

      {detailRoom && (
        <RoomDetailModal
          room={detailRoom}
          onClose={() => setDetailRoom(null)}
          onExport={() => exportRoom(detailRoom)}
        />
      )}
    </>
  )
}

function RoomCard({ room, onDetail }) {
  const preview = room.items.slice(0, 2)
  const extra = room.items.length - 2
  const hasFooter = room.coordinator || room.description || room.setor

  return (
    <div
      className="table-card"
      style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
      onClick={onDetail}
    >
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
            <strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {room.name}
            </strong>
          </div>
          {room.room_number && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Nº {room.room_number}
            </div>
          )}
        </div>
        <span
          style={{
            background: room.items.length > 0 ? 'rgba(16,185,129,.1)' : 'rgba(0,0,0,.06)',
            color: room.items.length > 0 ? '#059669' : 'var(--text-secondary)',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {room.items.length} equip.
        </span>
      </div>

      <div style={{ padding: '10px 16px', flex: 1 }}>
        {room.items.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
            Sem equipamentos
          </div>
        ) : (
          <>
            {preview.map((item, i) => (
              <div
                key={item.asset_number || item.serial_number || `${item.name}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '4px 0',
                  borderBottom: i < preview.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <Package size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {item.asset_number ? `PAT: ${formatAssetNumber(item.asset_number)}` : item.serial_number ? `Série: ${item.serial_number}` : ''}
                    {item.received_by ? (item.asset_number || item.serial_number ? ` · ${item.received_by}` : item.received_by) : ''}
                  </div>
                </div>
              </div>
            ))}
            {extra > 0 && (
              <div style={{ fontSize: 12, color: 'var(--accent-color)', marginTop: 6 }}>
                +{extra} equipamento{extra !== 1 ? 's' : ''} — clique para ver todos
              </div>
            )}
          </>
        )}
      </div>

      {hasFooter && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-color)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {[room.coordinator, room.description || room.setor].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}

function RoomDetailModal({ room, onClose, onExport }) {
  const [search, setSearch] = useState('')
  const [filterReceiver, setFilterReceiver] = useState('')

  const uniqueReceivers = useMemo(
    () => [...new Set(room.items.map((i) => i.received_by).filter(Boolean))].sort(),
    [room.items],
  )

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim()
    return room.items.filter((item) => {
      if (filterReceiver && item.received_by !== filterReceiver) return false
      if (q) {
        const hay = [
          item.name || '',
          formatAssetNumber(item.asset_number) || '',
          item.serial_number || '',
          item.received_by || '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [room.items, search, filterReceiver])

  const hasFilter = search || filterReceiver

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 900, width: '95vw' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} style={{ color: 'var(--accent-color)' }} />
              {room.name}
            </h3>
            {(room.room_number || room.coordinator) && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {room.room_number ? `Nº ${room.room_number}` : ''}
                {room.room_number && room.coordinator ? ' · ' : ''}
                {room.coordinator || ''}
              </div>
            )}
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {room.items.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
            <input
              type="text"
              className="form-control filter-control"
              placeholder="Buscar equipamento, patrimônio, série..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: '1 1 200px', minWidth: 160 }}
            />
            {uniqueReceivers.length > 0 && (
              <select
                className="form-control filter-control"
                value={filterReceiver}
                onChange={(e) => setFilterReceiver(e.target.value)}
                style={{ flex: '0 0 180px' }}
              >
                <option value="">Todos os recebedores</option>
                {uniqueReceivers.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {filteredItems.length !== room.items.length
                  ? `${filteredItems.length} de ${room.items.length} equipamento${room.items.length !== 1 ? 's' : ''}`
                  : `${room.items.length} equipamento${room.items.length !== 1 ? 's' : ''}`}
              </span>
              {hasFilter && (
                <button
                  className="btn-filter-clear"
                  onClick={() => { setSearch(''); setFilterReceiver('') }}
                >
                  <X size={12} /> Limpar
                </button>
              )}
              <button
                className="btn-table-action"
                onClick={onExport}
                style={{ color: '#059669', gap: 6 }}
              >
                <FileSpreadsheet size={14} /> Exportar Excel
              </button>
            </div>
          </div>
        )}

        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {room.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
              Nenhum equipamento nesta sala.
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
              Nenhum equipamento encontrado para esse filtro.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Nº Série</th>
                  <th>Nº Patrimônio</th>
                  <th>Recebedor</th>
                  <th>Última Movimentação</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, i) => (
                  <tr key={item.asset_number || item.serial_number || `${item.name}-${i}`}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {item.serial_number || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {formatAssetNumber(item.asset_number) || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.received_by || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {item.moved_at ? fmtDateTime(item.moved_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
