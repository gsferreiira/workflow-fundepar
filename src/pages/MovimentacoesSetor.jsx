import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { formatAssetNumber, fmtDateTime } from '../utils/format.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { Pagination } from '../components/Pagination.jsx'

const PAGE_SIZE = 25

export function MovimentacoesSetor() {
  const { sigla } = useParams()
  const { user } = useAuth()
  const room = user?.coordinator_room

  const [list, setList]       = useState(null)
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async (p = 1) => {
    if (!room?.id) return
    setList(null)
    setLoadError(null)

    const from = (p - 1) * PAGE_SIZE

    // Busca movimentações sem joins de FKs novas para evitar problema de cache
    const [countRes, dataRes] = await Promise.all([
      supabase
        .from('asset_movements')
        .select('id', { count: 'exact', head: true })
        .or(`origin_room_id.eq.${room.id},destination_room_id.eq.${room.id}`)
        .is('deleted_at', null),
      supabase
        .from('asset_movements')
        .select('id, asset_number, serial_number, moved_at, received_by, equipment_id, moved_by, origin_room_id, destination_room_id')
        .or(`origin_room_id.eq.${room.id},destination_room_id.eq.${room.id}`)
        .is('deleted_at', null)
        .order('moved_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
    ])

    if (dataRes.error) { setLoadError(dataRes.error.message); setList([]); return }

    const rows = dataRes.data || []
    if (rows.length === 0) { setTotal(0); setList([]); return }

    const eqIds      = [...new Set(rows.map((r) => r.equipment_id).filter(Boolean))]
    const roomIds    = [...new Set([...rows.map((r) => r.origin_room_id), ...rows.map((r) => r.destination_room_id)].filter(Boolean))]
    const profileIds = [...new Set(rows.map((r) => r.moved_by).filter(Boolean))]

    const enrichResults = await Promise.all([
      eqIds.length      ? supabase.from('equipment').select('id, name, categoria').in('id', eqIds)   : { data: [] },
      roomIds.length    ? supabase.from('rooms').select('id, name, sigla').in('id', roomIds)          : { data: [] },
      profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds)      : { data: [] },
    ]).catch((err) => { setLoadError(err.message); setList([]); return null })
    if (!enrichResults) return
    const [eqRes, roomRes, profileRes] = enrichResults

    const eqMap      = Object.fromEntries((eqRes.data      || []).map((x) => [x.id, x]))
    const roomMap    = Object.fromEntries((roomRes.data    || []).map((x) => [x.id, x]))
    const profileMap = Object.fromEntries((profileRes.data || []).map((x) => [x.id, x]))

    setTotal(countRes.count || 0)
    setList(rows.map((r) => ({
      ...r,
      equipment:        eqMap[r.equipment_id]      || null,
      origin:           roomMap[r.origin_room_id]  || null,
      destination:      roomMap[r.destination_room_id] || null,
      moved_by_profile: profileMap[r.moved_by]     || null,
    })))
  }, [room?.id])

  useEffect(() => { load(1) }, [load])

  const onPrev = () => { const p = page - 1; setPage(p); load(p); window.scrollTo(0, 0) }
  const onNext = () => { const p = page + 1; setPage(p); load(p); window.scrollTo(0, 0) }

  if (!room) return <SkeletonTable />

  if (loadError) return (
    <div style={{
      margin: '40px 0', padding: '20px 24px', borderRadius: 12,
      background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong style={{ color: '#dc2626' }}>Erro ao carregar movimentações</strong>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{loadError}</p>
      </div>
    </div>
  )

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Movimentações — {sigla?.toUpperCase()}</h2>
          <p>Histórico de entradas e saídas de equipamentos do setor.</p>
        </div>
        {list && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {total} movimentaç{total !== 1 ? 'ões' : 'ão'}
          </div>
        )}
      </div>

      {!list ? (
        <SkeletonTable />
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <p>Nenhuma movimentação registrada para este setor.</p>
        </div>
      ) : (
        <>
          <div className="table-card fade-in">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Nº Patrimônio</th>
                  <th>Tipo</th>
                  <th>Origem → Destino</th>
                  <th>Movido por (TI)</th>
                  <th>Recebido por</th>
                  <th>Data / Hora</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const isEntrada = m.destination?.id === room.id
                  const receivedName = m.received_by || null

                  return (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.equipment?.name || '—'}</strong>
                        {m.equipment?.categoria && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {m.equipment.categoria}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {m.asset_number ? formatAssetNumber(m.asset_number) : '—'}
                        {m.serial_number && (
                          <div style={{ fontSize: 11, marginTop: 2 }}>{m.serial_number}</div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: isEntrada ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.1)',
                          color: isEntrada ? '#059669' : '#dc2626',
                        }}>
                          {isEntrada ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}>
                            <MapPin size={11} />
                            {m.origin?.sigla || m.origin?.name || '—'}
                          </span>
                          <ArrowRight size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: isEntrada ? '#059669' : '#dc2626', fontWeight: 600 }}>
                            <MapPin size={11} />
                            {m.destination?.sigla || m.destination?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {m.moved_by_profile?.full_name || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {receivedName || <span style={{ fontStyle: 'italic' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(m.moved_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPrev={onPrev} onNext={onNext} />
        </>
      )}
    </>
  )
}
