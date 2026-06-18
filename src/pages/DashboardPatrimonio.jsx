import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, AlertTriangle, ArrowRightLeft, MapPin,
  LayoutGrid, ChevronRight, Archive,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { fmtDate } from '../utils/format.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { DOMINIOS, DOMINIO_ICONS } from '../config/dominios.js'

const DOMAIN_COLORS = {
  TI:             { color: '#6366f1', bg: 'rgba(99,102,241,.06)' },
  Mobiliário:     { color: '#059669', bg: 'rgba(16,185,129,.06)' },
  Eletrodoméstico:{ color: '#2563eb', bg: 'rgba(37,99,235,.06)'  },
  Outros:         { color: '#d97706', bg: 'rgba(245,158,11,.06)' },
}

const STATUS_COLORS = {
  novo:         { color: '#059669', label: 'Novo' },
  bom:          { color: '#2563eb', label: 'Bom' },
  regular:      { color: '#d97706', label: 'Regular' },
  inservível:   { color: '#dc2626', label: 'Inservível' },
  'com defeito':{ color: '#7e22ce', label: 'Com Defeito' },
}

function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg || 'var(--bg-card)', borderRadius: 14, padding: '18px 20px', borderLeft: `4px solid ${color}`, flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={18} style={{ color }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 16 }}>
      {children}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 8, padding: '8px 12px', fontSize: 13,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#6366f1' }}>{payload[0].value} movimentações</div>
    </div>
  )
}

// Gera os últimos N meses como [{ key: 'YYYY-MM', label: 'Jan' }, ...]
function getLastMonths(n = 6) {
  const months = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    })
  }
  return months
}

export function DashboardPatrimonio() {
  const { user } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const months = getLastMonths(6)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      sixMonthsAgo.setDate(1)

      const [locsRes, roomsRes, recentRes, monthlyMovsRes] = await Promise.all([
        supabase
          .from('equipment_locations')
          .select('id, equipment_id, asset_number, serial_number, current_room_id, equipment(name, dominio, status)'),
        supabase.from('rooms').select('id, name').is('deleted_at', null),
        supabase
          .from('asset_movements')
          .select('id, moved_at, asset_number, equipment(name, dominio), destination_room:destination_room_id(name)')
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })
          .limit(8),
        supabase
          .from('asset_movements')
          .select('id, moved_at')
          .is('deleted_at', null)
          .gte('moved_at', sixMonthsAgo.toISOString()),
      ])

      if (cancelled) return

      const locs    = locsRes.data  || []
      const rooms   = roomsRes.data || []
      const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]))

      // Breakdown por domínio
      const byDomain = {}
      for (const d of DOMINIOS) byDomain[d] = 0
      locs.forEach((l) => {
        const d = l.equipment?.dominio || 'TI'
        byDomain[d] = (byDomain[d] || 0) + 1
      })

      // Breakdown por status
      const byStatus = {}
      locs.forEach((l) => {
        const s = (l.equipment?.status || 'bom').toLowerCase()
        byStatus[s] = (byStatus[s] || 0) + 1
      })

      // Itens com problema
      const withProblem = locs.filter((l) =>
        ['inservível', 'com defeito'].includes(l.equipment?.status),
      ).length

      // Top salas
      const roomCount = {}
      locs.forEach((l) => {
        if (!l.current_room_id) return
        roomCount[l.current_room_id] = (roomCount[l.current_room_id] || 0) + 1
      })
      const topRooms = Object.entries(roomCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, count]) => ({ id, name: roomMap[id]?.name || '—', count }))

      // Movimentações por mês (últimos 6 meses)
      const movCountMap = {}
      for (const m of months) movCountMap[m.key] = 0
      ;(monthlyMovsRes.data || []).forEach((m) => {
        const key = m.moved_at.slice(0, 7)
        if (movCountMap[key] !== undefined) movCountMap[key]++
      })
      const movByMonth = months.map((m) => ({ month: m.label, count: movCountMap[m.key] }))

      setData({ total: locs.length, byDomain, byStatus, withProblem, topRooms, recentMovs: recentRes.data || [], movByMonth })
    }

    load().catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!data) return <SkeletonTable />

  const { total, byDomain, byStatus, withProblem, topRooms, recentMovs, movByMonth } = data
  const maxDomainCount = Math.max(...Object.values(byDomain), 1)
  const totalStatus    = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1
  const hasMovData     = movByMonth.some((m) => m.count > 0)

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Painel — Patrimônio</h2>
          <p>Olá, {user?.full_name?.split(' ')[0] || 'Usuário'}! Visão geral de todos os bens tombados.</p>
        </div>
      </div>

      {/* Stats principais */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard icon={Archive}       label="Total tombado"  value={total}       sub="bens registrados"        color="#6366f1" bg="rgba(99,102,241,.06)" />
        <StatCard icon={Package}       label="TI"             value={byDomain.TI} sub="equipamentos de TI"      color="#2563eb" bg="rgba(37,99,235,.06)"  />
        <StatCard icon={LayoutGrid}    label="Mobiliário"     value={byDomain['Mobiliário']} sub="mesas, cadeiras, etc." color="#059669" bg="rgba(16,185,129,.06)" />
        <StatCard
          icon={AlertTriangle}
          label="Com problema"
          value={withProblem}
          sub={withProblem > 0 ? 'precisam de atenção' : 'todos em ordem'}
          color={withProblem > 0 ? '#dc2626' : '#059669'}
          bg={withProblem > 0 ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)'}
        />
      </div>

      {/* Gráfico de movimentações + Breakdown de status */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Gráfico movimentações por mês */}
        <div className="table-card fade-in" style={{ padding: '18px 20px' }}>
          <SectionTitle>Movimentações nos últimos 6 meses</SectionTitle>
          {hasMovData ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={movByMonth} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,.06)' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              Nenhuma movimentação nos últimos 6 meses.
            </div>
          )}
        </div>

        {/* Breakdown por status */}
        <div className="table-card fade-in" style={{ padding: '18px 20px' }}>
          <SectionTitle>Condição dos bens</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(STATUS_COLORS).map(([key, cfg]) => {
              const count = byStatus[key] || 0
              const pct   = Math.round((count / totalStatus) * 100)
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 4, transition: 'width .4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Breakdown por classificação + Top salas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Distribuição por classificação */}
        <div className="table-card fade-in" style={{ padding: '18px 20px' }}>
          <SectionTitle>Distribuição por classificação</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DOMINIOS.map((d) => {
              const count = byDomain[d] || 0
              const pct   = total ? Math.round((count / total) * 100) : 0
              const cfg   = DOMAIN_COLORS[d] || DOMAIN_COLORS.Outros
              return (
                <div key={d}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>{DOMINIO_ICONS[d]} {d}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{count} <span style={{ fontSize: 11 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxDomainCount) * 100}%`, background: cfg.color, borderRadius: 6, transition: 'width .4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top salas */}
        <div className="table-card fade-in" style={{ padding: '18px 20px' }}>
          <SectionTitle>Salas com mais bens</SectionTitle>
          {topRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              Nenhum bem registrado ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topRooms.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? 'rgba(99,102,241,.12)' : 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#6366f1' : 'var(--text-secondary)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>{r.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Movimentações recentes */}
      <div className="table-card fade-in" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <SectionTitle>Movimentações recentes</SectionTitle>
          <Link to="/movimentacoes" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            Ver todas <ChevronRight size={13} />
          </Link>
        </div>
        {recentMovs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            <ArrowRightLeft size={28} style={{ opacity: .2, display: 'block', margin: '0 auto 8px' }} />
            Nenhuma movimentação encontrada.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentMovs.map((m) => {
              const dominio = m.equipment?.dominio || 'TI'
              const cfg = DOMAIN_COLORS[dominio] || DOMAIN_COLORS.Outros
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={15} style={{ color: cfg.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.equipment?.name || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <MapPin size={10} /> {m.destination_room?.name || '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>{fmtDate(m.moved_at)}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
                    {dominio}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {[
          { to: '/registro',      icon: LayoutGrid,    label: 'Inventário',      desc: 'Todos os bens tombados',     color: '#6366f1' },
          { to: '/movimentacoes', icon: ArrowRightLeft, label: 'Movimentações',   desc: 'Histórico de transferências', color: '#2563eb' },
          { to: '/mapa-salas',    icon: MapPin,         label: 'Mapa de Salas',   desc: 'Distribuição por sala',      color: '#059669' },
          { to: '/conferencias',  icon: Package,        label: 'Conferências',    desc: 'Conferências mensais',       color: '#d97706' },
        ].map(({ to, icon: Icon, label, desc, color }) => (
          <Link key={to} to={to} style={{ textDecoration: 'none' }}>
            <div
              style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, transition: 'transform .15s, box-shadow .15s', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{desc}</div>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
