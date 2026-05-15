import { useEffect, useState } from 'react'
import {
  Ticket,
  CheckCircle,
  MapPin,
  Package,
  BarChart2,
  ArrowRightLeft,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { SkeletonDashboard } from '../components/Skeleton.jsx'
import { fmtDate, fmtTime } from '../utils/format.js'

export function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      sixMonthsAgo.setHours(0, 0, 0, 0)

      const [
        { count: totalOpen },
        { count: totalResolved },
        { count: totalRooms },
        { count: totalEquipment },
        { data: recentMovements },
        { data: rooms },
        { data: profilesList },
        { data: chartMovements },
      ] = await Promise.all([
        supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aberto')
          .is('deleted_at', null),
        supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'resolvido')
          .is('deleted_at', null),
        supabase
          .from('rooms')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('equipment')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('asset_movements')
          .select('*, equipment(name)')
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })
          .limit(8),
        supabase.from('rooms').select('id, name').is('deleted_at', null),
        supabase.from('profiles').select('id, full_name').is('deleted_at', null),
        supabase
          .from('asset_movements')
          .select('moved_at')
          .is('deleted_at', null)
          .gte('moved_at', sixMonthsAgo.toISOString()),
      ])

      if (cancelled) return

      const roomMap = Object.fromEntries((rooms || []).map((r) => [r.id, r]))
      const profileMap = Object.fromEntries((profilesList || []).map((p) => [p.id, p]))
      const recent = (recentMovements || []).map((m) => ({
        ...m,
        origin: roomMap[m.origin_room_id] || null,
        destination: roomMap[m.destination_room_id] || null,
        profiles: profileMap[m.moved_by] || null,
      }))

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      const chartData = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        d.setDate(1)
        chartData.push({
          label: monthNames[d.getMonth()],
          year: d.getFullYear(),
          month: d.getMonth(),
          count: 0,
        })
      }
      ;(chartMovements || []).forEach((m) => {
        const d = new Date(m.moved_at)
        const entry = chartData.find(
          (c) => c.month === d.getMonth() && c.year === d.getFullYear(),
        )
        if (entry) entry.count++
      })

      setData({
        stats: { totalOpen, totalResolved, totalRooms, totalEquipment },
        recent,
        chartData,
      })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return <SkeletonDashboard />

  const { stats, recent, chartData } = data
  const chartMax = Math.max(...chartData.map((c) => c.count), 1)

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Olá, {user?.full_name || 'Usuário'}</h2>
          <p>Resumo da operação e controle de atividades hoje.</p>
        </div>
      </div>
      <div className="stat-grid fade-in">
        <div className="stat-card">
          <div className="icon-box">
            <Ticket size={20} />
          </div>
          <div>
            <div className="value">{stats.totalOpen || 0}</div>
            <div className="label">Chamados Pendentes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: 'rgba(16,185,129,.1)', color: 'var(--success-color)' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="value">{stats.totalResolved || 0}</div>
            <div className="label">Chamados Resolvidos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: 'rgba(245,158,11,.1)', color: 'var(--warning-color)' }}>
            <MapPin size={20} />
          </div>
          <div>
            <div className="value">{stats.totalRooms || 0}</div>
            <div className="label">Locais / Salas</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-box" style={{ background: 'rgba(99,102,241,.1)', color: '#6366f1' }}>
            <Package size={20} />
          </div>
          <div>
            <div className="value">{stats.totalEquipment || 0}</div>
            <div className="label">Equipamentos</div>
          </div>
        </div>
      </div>

      {chartData?.length > 0 && (
        <div className="dashboard-section fade-in" style={{ marginBottom: 28 }}>
          <div className="dashboard-section-header">
            <h3>
              <BarChart2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Movimentações por Mês
            </h3>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Últimos 6 meses</span>
          </div>
          <div className="table-card" style={{ padding: '20px 24px 16px' }}>
            <div className="chart-wrap">
              <div className="chart-bars">
                {chartData.map((c, i) => (
                  <div
                    className={`chart-col${c.count === 0 ? ' chart-zero' : ''}`}
                    key={i}
                    title={`${c.count} movimentaç${c.count !== 1 ? 'ões' : 'ão'} em ${c.label}`}
                  >
                    <div className="chart-col-val">{c.count > 0 ? c.count : ''}</div>
                    <div
                      className="chart-bar"
                      style={{ height: Math.round((c.count / chartMax) * 88) + 4 + 'px' }}
                    ></div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {chartData.map((c, i) => (
                  <div className="chart-col-label" key={i} style={{ flex: 1, textAlign: 'center' }}>
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {recent?.length > 0 && (
        <div className="dashboard-section fade-in">
          <div className="dashboard-section-header">
            <h3>
              <ArrowRightLeft size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Movimentações Recentes
            </h3>
            <Link to="/movimentacoes" className="dashboard-section-link">
              Ver todas <ArrowRight size={13} style={{ verticalAlign: 'middle' }} />
            </Link>
          </div>
          <div className="table-card" style={{ padding: 0 }}>
            <table className="data-table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>De</th>
                  <th>Para</th>
                  <th>Responsável</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.equipment?.name || '—'}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        {m.origin?.name || '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--accent-color)',
                        }}
                      >
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        {m.destination?.name || '—'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {m.profiles?.full_name || '—'}
                    </td>
                    <td
                      style={{
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        fontSize: 13,
                      }}
                    >
                      {fmtDate(m.moved_at)}
                      <span style={{ opacity: 0.6 }}> {fmtTime(m.moved_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
