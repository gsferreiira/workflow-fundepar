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
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  CheckCircle,
  Clock,
  MapPin,
  Package,
  PieChart as PieChartIcon,
  Ticket,
  TrendingUp,
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
const PRIORITY_LABELS = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }

// Filtros temporais disponíveis no Dashboard (#25).
// Cada chave mapeia para a janela de tempo + a granularidade da série temporal.
const PERIODS = {
  '7d': { label: '7 dias', days: 7, bucket: 'day', buckets: 7 },
  '30d': { label: '30 dias', days: 30, bucket: 'day', buckets: 30 },
  '6m': { label: '6 meses', days: 30 * 6, bucket: 'month', buckets: 6 },
  '12m': { label: '12 meses', days: 30 * 12, bucket: 'month', buckets: 12 },
}

const ASSET_STALE_DAYS = 90 // equipamento sem movimentação por mais de N dias = "parado"

const startOfPeriod = (period) => {
  const days = PERIODS[period].days
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

// Gera as "caixas" vazias da série temporal conforme o período.
const emptyBuckets = (period) => {
  const { bucket, buckets } = PERIODS[period]
  const out = []
  for (let i = buckets - 1; i >= 0; i--) {
    const d = new Date()
    if (bucket === 'month') {
      d.setMonth(d.getMonth() - i)
      d.setDate(1)
      out.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MONTHS[d.getMonth()],
        chamados: 0,
        movimentacoes: 0,
        auditoria: 0,
      })
    } else {
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      out.push({
        key: d.toISOString().slice(0, 10),
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        chamados: 0,
        movimentacoes: 0,
        auditoria: 0,
      })
    }
  }
  return out
}

const bucketKey = (date, period) => {
  const d = new Date(date)
  if (PERIODS[period].bucket === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return d.toISOString().slice(0, 10)
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

// Formata duração em horas para "Xh Ym" ou "Xd Yh" conforme tamanho.
const fmtDuration = (hours) => {
  if (!hours || hours < 0) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return m ? `${h}h ${m}m` : `${h}h`
  }
  const days = Math.floor(hours / 24)
  const h = Math.round(hours - days * 24)
  return h ? `${days}d ${h}h` : `${days}d`
}

export function Dashboard() {
  const [period, setPeriod] = useState('6m')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    setData(null)

    const load = async () => {
      const startDate = startOfPeriod(period)
      const startIso = startDate.toISOString()
      const staleDate = new Date()
      staleDate.setDate(staleDate.getDate() - ASSET_STALE_DAYS)
      const staleIso = staleDate.toISOString()

      const [
        { count: pendingTickets },
        { count: resolvedTickets },
        { count: totalRooms },
        { count: totalUsers },
        { data: profiles },
        { data: equipment },
        { data: rooms },
        { data: assetLocations },
        { data: recentMovements },
        { data: periodMovements },
        { data: ticketsHistory },
        { data: auditLogs },
        { data: resolvedTicketsTimes },
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
        supabase.from('rooms').select('id, name').is('deleted_at', null),
        supabase
          .from('equipment_locations')
          .select(
            'id, equipment_id, equipment(name,categoria), asset_number, serial_number, moved_at',
          ),
        supabase
          .from('asset_movements')
          .select(
            'id, equipment_id, equipment(name,categoria), origin_room_id, destination_room_id, moved_by, moved_at, asset_number, serial_number, received_by',
          )
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })
          .limit(10),
        supabase
          .from('asset_movements')
          .select(
            'id, equipment_id, equipment(name,categoria), origin_room_id, destination_room_id, moved_by, moved_at, asset_number, serial_number',
          )
          .is('deleted_at', null)
          .gte('moved_at', startIso),
        supabase
          .from('tickets')
          .select('id, status, priority, created_at, updated_at')
          .is('deleted_at', null)
          .gte('created_at', startIso),
        supabase
          .from('audit_logs')
          .select('id, action, table_name, actor_id, actor_name, created_at')
          .gte('created_at', startIso)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('tickets')
          .select('priority, created_at, updated_at')
          .eq('status', 'resolvido')
          .is('deleted_at', null)
          .gte('created_at', startIso),
      ])

      if (cancelled) return

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
      const equipmentMap = Object.fromEntries((equipment || []).map((e) => [e.id, e]))
      const roomMap = Object.fromEntries((rooms || []).map((r) => [r.id, r]))
      const buckets = emptyBuckets(period)

      // Série temporal — distribui movements, tickets e audit_logs por bucket
      ;(periodMovements || []).forEach((movement) => {
        const item = buckets.find((b) => b.key === bucketKey(movement.moved_at, period))
        if (item) item.movimentacoes += 1
      })
      ;(ticketsHistory || []).forEach((ticket) => {
        const item = buckets.find((b) => b.key === bucketKey(ticket.created_at, period))
        if (item) item.chamados += 1
      })
      ;(auditLogs || []).forEach((log) => {
        const item = buckets.find((b) => b.key === bucketKey(log.created_at, period))
        if (item) item.auditoria += 1
      })

      // Patrimônios por categoria
      const assetsByNumber = new Map()
      ;(assetLocations || []).forEach((asset) => {
        const assetKey = asset.asset_number || asset.serial_number || asset.id
        if (!assetsByNumber.has(assetKey)) {
          const eq = asset.equipment || equipmentMap[asset.equipment_id] || {}
          assetsByNumber.set(assetKey, {
            categoria: eq.categoria || 'Sem categoria',
            moved_at: asset.moved_at,
          })
        }
      })
      ;(periodMovements || []).forEach((movement) => {
        const assetKey = movement.asset_number || movement.serial_number || movement.id
        if (!assetsByNumber.has(assetKey)) {
          const eq = movement.equipment || equipmentMap[movement.equipment_id] || {}
          assetsByNumber.set(assetKey, {
            categoria: eq.categoria || 'Sem categoria',
            moved_at: movement.moved_at,
          })
        }
      })

      const equipmentByCategory = groupCount(
        [...assetsByNumber.values()],
        (asset) => asset.categoria,
      )
      const usersByRole = groupCount(
        profiles || [],
        (profile) => ROLE_LABELS[profile.role] || profile.role,
      )
      const activitiesByAction = groupCount(
        auditLogs || [],
        (log) => ACTION_LABELS[log.action] || log.action,
      ).slice(0, 6)

      // ── #24 — Métricas avançadas ────────────────────────────────────

      // Top 10 equipamentos mais movimentados no período
      const movementsByEquipment = new Map()
      ;(periodMovements || []).forEach((m) => {
        if (!m.equipment_id) return
        const cur = movementsByEquipment.get(m.equipment_id) || {
          id: m.equipment_id,
          name: m.equipment?.name || equipmentMap[m.equipment_id]?.name || '—',
          count: 0,
        }
        cur.count += 1
        movementsByEquipment.set(m.equipment_id, cur)
      })
      const topEquipments = [...movementsByEquipment.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((e) => ({ name: e.name, value: e.count }))

      // Salas com mais fluxo (entrada + saída)
      const roomFlow = new Map()
      ;(periodMovements || []).forEach((m) => {
        if (m.origin_room_id) {
          const cur = roomFlow.get(m.origin_room_id) || {
            id: m.origin_room_id,
            name: roomMap[m.origin_room_id]?.name || '—',
            saidas: 0,
            entradas: 0,
          }
          cur.saidas += 1
          roomFlow.set(m.origin_room_id, cur)
        }
        if (m.destination_room_id) {
          const cur = roomFlow.get(m.destination_room_id) || {
            id: m.destination_room_id,
            name: roomMap[m.destination_room_id]?.name || '—',
            saidas: 0,
            entradas: 0,
          }
          cur.entradas += 1
          roomFlow.set(m.destination_room_id, cur)
        }
      })
      const topRooms = [...roomFlow.values()]
        .map((r) => ({ ...r, total: r.entradas + r.saidas }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)

      // Tempo médio de resolução por prioridade (em horas)
      // Aproximação: usa updated_at - created_at. Funciona se o ticket foi para
      // 'resolvido' como última atualização — pode superestimar se foi editado depois.
      const resolutionByPriority = new Map()
      ;(resolvedTicketsTimes || []).forEach((t) => {
        if (!t.created_at || !t.updated_at) return
        const created = new Date(t.created_at)
        const resolved = new Date(t.updated_at)
        const hours = (resolved - created) / 3_600_000
        if (hours < 0) return
        const key = t.priority || 'media'
        const cur = resolutionByPriority.get(key) || { sum: 0, count: 0 }
        cur.sum += hours
        cur.count += 1
        resolutionByPriority.set(key, cur)
      })
      const resolutionData = ['urgente', 'alta', 'media', 'baixa']
        .filter((p) => resolutionByPriority.has(p))
        .map((p) => {
          const v = resolutionByPriority.get(p)
          return {
            name: PRIORITY_LABELS[p],
            value: Number((v.sum / v.count).toFixed(1)),
            count: v.count,
          }
        })

      // Equipamentos parados há > ASSET_STALE_DAYS sem movimentação
      const staleAssets = (assetLocations || [])
        .filter((a) => a.moved_at && new Date(a.moved_at) < new Date(staleIso))
        .map((a) => ({
          asset_number: a.asset_number,
          serial_number: a.serial_number,
          name: a.equipment?.name || equipmentMap[a.equipment_id]?.name || '—',
          moved_at: a.moved_at,
          days: Math.floor(
            (Date.now() - new Date(a.moved_at).getTime()) / (24 * 3_600_000),
          ),
        }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 10)

      const recent = (recentMovements || []).map((movement) => ({
        ...movement,
        profile: profileMap[movement.moved_by] || null,
      }))

      const totalTickets = (pendingTickets || 0) + (resolvedTickets || 0)
      const totalAssets = [...assetsByNumber.keys()].length
      const totalAudit = (auditLogs || []).length
      const activeActors = new Set(
        (auditLogs || []).map((log) => log.actor_id).filter(Boolean),
      ).size

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
          traffic: buckets,
          equipmentByCategory,
          usersByRole,
          activitiesByAction,
          topEquipments,
          topRooms,
          resolutionData,
          staleAssets,
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
  }, [period])

  const chartTheme = useMemo(
    () => ({
      grid: 'var(--border-color)',
      text: 'var(--text-secondary)',
      tooltipBg: 'var(--bg-card)',
      tooltipBorder: 'var(--border-color)',
    }),
    [],
  )

  if (!data) {
    return (
      <>
        <DashboardHeader period={period} onPeriodChange={setPeriod} />
        <SkeletonDashboard />
      </>
    )
  }

  const { stats, recent, charts } = data

  return (
    <>
      <DashboardHeader period={period} onPeriodChange={setPeriod} />

      <div className="stat-grid dashboard-stat-grid fade-in">
        <MetricCard icon={Ticket} value={stats.pendingTickets} label="Chamados Pendentes" tone="info" />
        <MetricCard icon={CheckCircle} value={stats.resolvedTickets} label="Chamados Resolvidos" tone="success" />
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
          subtitle={`Chamados, movimentações e auditoria nos últimos ${PERIODS[period].label}`}
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
          title="Top 10 Equipamentos Movimentados"
          subtitle={`Patrimônios com mais trocas de sala (${PERIODS[period].label})`}
          icon={TrendingUp}
        >
          {charts.topEquipments.length === 0 ? (
            <EmptyState message="Sem movimentações no período selecionado." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={charts.topEquipments}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: chartTheme.text, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip content={<DashboardTooltip />} />
                <Bar dataKey="value" name="Movimentações" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Salas com Mais Fluxo"
          subtitle="Entradas e saídas de patrimônio por sala"
          icon={MapPin}
        >
          {charts.topRooms.length === 0 ? (
            <EmptyState message="Sem movimentações por sala no período." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.topRooms} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: chartTheme.text, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DashboardTooltip />} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Tempo Médio de Resolução"
          subtitle="Chamados resolvidos por prioridade (horas)"
          icon={Clock}
        >
          {charts.resolutionData.length === 0 ? (
            <EmptyState message="Sem chamados resolvidos no período." />
          ) : (
            <div className="resolution-list">
              {charts.resolutionData.map((item, index) => (
                <div className="resolution-row" key={item.name}>
                  <div className="resolution-priority">
                    <span
                      className="resolution-dot"
                      style={{ background: COLORS[index % COLORS.length] }}
                    ></span>
                    <strong>{item.name}</strong>
                    <span className="resolution-count">
                      ({item.count} chamado{item.count !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <span className="resolution-time">{fmtDuration(item.value)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Visitantes por Tipo"
          subtitle="Distribuição dos usuários por perfil"
          icon={PieChartIcon}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={charts.usersByRole} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={3}>
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
            <BarChart
              data={charts.equipmentByCategory.slice(0, 8)}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
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

        <ChartCard
          title={`Equipamentos Parados (>${ASSET_STALE_DAYS} dias)`}
          subtitle="Patrimônios sem movimentação registrada"
          icon={AlertTriangle}
          className="dashboard-chart-wide"
        >
          {charts.staleAssets.length === 0 ? (
            <EmptyState message={`Nenhum equipamento parado há mais de ${ASSET_STALE_DAYS} dias.`} />
          ) : (
            <div className="stale-list">
              {charts.staleAssets.map((asset, idx) => (
                <div className="stale-row" key={`${asset.asset_number || idx}`}>
                  <div className="stale-info">
                    <strong>{asset.name}</strong>
                    {asset.asset_number && (
                      <span className="stale-pat">
                        PAT {formatAssetNumber(asset.asset_number)}
                      </span>
                    )}
                  </div>
                  <span className="stale-days">{asset.days} dias parado</span>
                </div>
              ))}
            </div>
          )}
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

function DashboardHeader({ period, onPeriodChange }) {
  return (
    <div className="view-header dashboard-header">
      <div>
        <h2>Dashboard</h2>
        <p>Indicadores operacionais, movimentações e uso recente do workflow.</p>
      </div>
      <div className="period-toggle" role="tablist" aria-label="Período do dashboard">
        {Object.entries(PERIODS).map(([key, info]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={period === key}
            className={`period-toggle-btn ${period === key ? 'active' : ''}`}
            onClick={() => onPeriodChange(key)}
          >
            {info.label}
          </button>
        ))}
      </div>
    </div>
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

function EmptyState({ message }) {
  return (
    <div
      style={{
        padding: 32,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: 13,
      }}
    >
      {message}
    </div>
  )
}
