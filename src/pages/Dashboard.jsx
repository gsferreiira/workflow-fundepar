import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  CheckCircle,
  MapPin,
  Package,
  PieChart as PieChartIcon,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { SkeletonDashboard } from '../components/Skeleton.jsx'
import { fmtDate, fmtTime, formatAssetNumber } from '../utils/format.js'

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6']
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ROLE_LABELS = { admin: 'Administradores', tecnico: 'Técnicos', usuario: 'Usuários' }
const ACTION_LABELS = {
  create: 'Criações',
  update: 'Atualizações',
  delete: 'Exclusões',
  restore: 'Restaurações',
  password_reset: 'Redefinições',
}

const emptyByMonth = () => {
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    d.setDate(1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS[d.getMonth()],
      chamados: 0,
      movimentacoes: 0,
      auditoria: 0,
    })
  }
  return months
}

const monthKey = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const percent = (value, total) => {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function groupCount(items, keyGetter, fallback = 'Não informado') {
  const map = new Map()
  items.forEach((item) => {
    const key = keyGetter(item) || fallback
    map.set(key, (map.get(key) || 0) + 1)
  })
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      sixMonthsAgo.setHours(0, 0, 0, 0)

      const [
        { count: pendingTickets },
        { count: resolvedTickets },
        { count: totalRooms },
        { count: totalUsers },
        { data: profiles },
        { data: equipment },
        { data: assetLocations },
        { data: recentMovements },
        { data: allMovements },
        { data: ticketsHistory },
        { data: auditLogs },
      ] = await Promise.all([
        supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .in('status', ['aberto', 'em_progresso'])
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
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase.from('profiles').select('id, full_name, role').is('deleted_at', null),
        supabase.from('equipment').select('id, name, categoria').is('deleted_at', null),
        supabase
          .from('equipment_locations')
          .select('id, equipment_id, equipment(name,categoria), asset_number, serial_number'),
        supabase
          .from('asset_movements')
          .select('id, equipment_id, equipment(name,categoria), origin_room_id, destination_room_id, moved_by, moved_at, asset_number, serial_number, received_by')
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })
          .limit(10),
        supabase
          .from('asset_movements')
          .select('id, equipment_id, equipment(name,categoria), moved_by, moved_at, asset_number, serial_number')
          .is('deleted_at', null)
          .gte('moved_at', sixMonthsAgo.toISOString()),
        supabase
          .from('tickets')
          .select('id, status, created_at')
          .is('deleted_at', null)
          .gte('created_at', sixMonthsAgo.toISOString()),
        supabase
          .from('audit_logs')
          .select('id, action, table_name, actor_id, actor_name, created_at')
          .gte('created_at', sixMonthsAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(300),
      ])

      if (cancelled) return

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
      const equipmentMap = Object.fromEntries((equipment || []).map((e) => [e.id, e]))
      const months = emptyByMonth()

      ;(allMovements || []).forEach((movement) => {
        const item = months.find((m) => m.key === monthKey(movement.moved_at))
        if (item) item.movimentacoes += 1
      })
      ;(ticketsHistory || []).forEach((ticket) => {
        const item = months.find((m) => m.key === monthKey(ticket.created_at))
        if (item) item.chamados += 1
      })
      ;(auditLogs || []).forEach((log) => {
        const item = months.find((m) => m.key === monthKey(log.created_at))
        if (item) item.auditoria += 1
      })

      const assetsByNumber = new Map()
      ;(assetLocations || []).forEach((asset) => {
        const assetKey = asset.asset_number || asset.serial_number || asset.id
        if (!assetsByNumber.has(assetKey)) {
          const eq = asset.equipment || equipmentMap[asset.equipment_id] || {}
          assetsByNumber.set(assetKey, {
            categoria: eq.categoria || 'Sem categoria',
          })
        }
      })
      ;(allMovements || []).forEach((movement) => {
        const assetKey = movement.asset_number || movement.serial_number || movement.id
        if (!assetsByNumber.has(assetKey)) {
          const eq = movement.equipment || equipmentMap[movement.equipment_id] || {}
          assetsByNumber.set(assetKey, {
            categoria: eq.categoria || 'Sem categoria',
          })
        }
      })

      const equipmentByCategory = groupCount([...assetsByNumber.values()], (asset) => asset.categoria)
      const usersByRole = groupCount(profiles || [], (profile) => ROLE_LABELS[profile.role] || profile.role)
      const activitiesByAction = groupCount(
        auditLogs || [],
        (log) => ACTION_LABELS[log.action] || log.action,
      ).slice(0, 6)

      const recent = (recentMovements || []).map((movement) => ({
        ...movement,
        profile: profileMap[movement.moved_by] || null,
      }))

      const totalTickets = (pendingTickets || 0) + (resolvedTickets || 0)
      const totalAssets = [...assetsByNumber.keys()].length
      const totalAudit = (auditLogs || []).length
      const activeActors = new Set((auditLogs || []).map((log) => log.actor_id).filter(Boolean)).size

      setData({
        stats: {
          pendingTickets: pendingTickets || 0,
          resolvedTickets: resolvedTickets || 0,
          totalRooms: totalRooms || 0,
          totalAssets,
          totalUsers: totalUsers || 0,
        },
        recent,
        charts: {
          traffic: months,
          equipmentByCategory,
          usersByRole,
          activitiesByAction,
          usability: [
            { name: 'Chamados resolvidos', value: percent(resolvedTickets || 0, totalTickets) },
            { name: 'Usuários ativos', value: percent(activeActors, totalUsers || 0) },
            { name: 'Atividades recentes', value: Math.min(totalAudit, 100) },
            { name: 'Patrimônios rastreados', value: Math.min(totalAssets, 100) },
          ],
        },
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const chartTheme = useMemo(
    () => ({
      grid: 'var(--border-color)',
      text: 'var(--text-secondary)',
      tooltipBg: 'var(--bg-card)',
      tooltipBorder: 'var(--border-color)',
    }),
    [],
  )

  if (!data) return <SkeletonDashboard />

  const { stats, recent, charts } = data

  return (
    <>
      <div className="view-header dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <p>Indicadores operacionais, movimentações e uso recente do workflow.</p>
        </div>
      </div>

      <div className="stat-grid dashboard-stat-grid fade-in">
        <MetricCard
          icon={Ticket}
          value={stats.pendingTickets}
          label="Chamados Pendentes"
          tone="info"
        />
        <MetricCard
          icon={CheckCircle}
          value={stats.resolvedTickets}
          label="Chamados Resolvidos"
          tone="success"
        />
        <MetricCard icon={MapPin} value={stats.totalRooms} label="Locais / Salas" tone="warning" />
        <MetricCard
          icon={Package}
          value={stats.totalAssets}
          label="Equipamentos Patrimoniais"
          tone="purple"
          subtitle="Contagem por patrimônio"
        />
        <MetricCard icon={Users} value={stats.totalUsers} label="Usuários" tone="neutral" />
      </div>

      <div className="dashboard-charts-grid fade-in">
        <ChartCard
          title="Histórico de Tráfego"
          subtitle="Chamados, movimentações e auditoria nos últimos 6 meses"
          icon={BarChart3}
          className="dashboard-chart-wide"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={charts.traffic} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficMoves" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="trafficTickets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<DashboardTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="movimentacoes" name="Movimentações" stroke="#0ea5e9" fill="url(#trafficMoves)" strokeWidth={2} />
              <Area type="monotone" dataKey="chamados" name="Chamados" stroke="#10b981" fill="url(#trafficTickets)" strokeWidth={2} />
              <Area type="monotone" dataKey="auditoria" name="Atividades" stroke="#6366f1" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Visitantes por Tipo"
          subtitle="Distribuição dos usuários por perfil"
          icon={PieChartIcon}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={charts.usersByRole}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={94}
                paddingAngle={3}
              >
                {charts.usersByRole.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<DashboardTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Atividades dos Visitantes"
          subtitle="Ações registradas na auditoria do sistema"
          icon={Activity}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.activitiesByAction} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<DashboardTooltip />} />
              <Bar dataKey="value" name="Atividades" radius={[6, 6, 0, 0]}>
                {charts.activitiesByAction.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Equipamentos por Categoria"
          subtitle="Contagem feita por patrimônio movimentado"
          icon={Package}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.equipmentByCategory.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<DashboardTooltip />} />
              <Bar dataKey="value" name="Patrimônios" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Estatísticas de Usabilidade"
          subtitle="Indicadores normalizados para leitura rápida"
          icon={UserRound}
        >
          <div className="usability-list">
            {charts.usability.map((item, index) => (
              <div className="usability-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.value}%</span>
                </div>
                <div className="usability-track">
                  <div
                    className="usability-fill"
                    style={{
                      width: `${Math.min(item.value, 100)}%`,
                      background: COLORS[index % COLORS.length],
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="dashboard-section fade-in">
        <div className="dashboard-section-header">
          <h3>
            <ArrowRightLeft size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Últimas Movimentações
          </h3>
          <Link to="/movimentacoes" className="dashboard-section-link">
            Ver todas <ArrowRight size={13} style={{ verticalAlign: 'middle' }} />
          </Link>
        </div>
        <div className="table-card" style={{ padding: 0 }}>
          <table className="data-table dashboard-movements-table">
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>Patrimônio</th>
                <th>Categoria</th>
                <th>Responsável</th>
                <th>Recebedor</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              ) : (
                recent.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <strong>{movement.equipment?.name || '—'}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatAssetNumber(movement.asset_number) || movement.serial_number || '—'}
                    </td>
                    <td>
                      <span className="dashboard-category-pill">
                        {movement.equipment?.categoria || 'Sem categoria'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {movement.profile?.full_name || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {movement.received_by || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {fmtDate(movement.moved_at)}
                      <span style={{ opacity: 0.6 }}> {fmtTime(movement.moved_at)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function MetricCard({ icon: Icon, value, label, subtitle, tone }) {
  return (
    <div className="stat-card dashboard-stat-card">
      <div className={`icon-box dashboard-icon-${tone || 'info'}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="value">{value || 0}</div>
        <div className="label">{label}</div>
        {subtitle && <div className="dashboard-stat-subtitle">{subtitle}</div>}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, icon: Icon, className = '', children }) {
  return (
    <section className={`dashboard-chart-card ${className}`}>
      <div className="dashboard-chart-header">
        <div>
          <h3>
            <Icon size={16} /> {title}
          </h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="dashboard-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((entry) => (
        <div key={entry.name || entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  )
}
