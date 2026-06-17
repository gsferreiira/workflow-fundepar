import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Package, AlertTriangle, CalendarCheck, ArrowDownToLine,
  LayoutGrid, ArrowRightLeft, ClipboardList, ChevronRight, CalendarX,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { fmtDate } from '../utils/format.js'
import { SkeletonTable } from '../components/Skeleton.jsx'

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function compLabel(comp) {
  if (!comp) return ''
  const [y, m] = comp.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div style={{
      background: bg || 'var(--bg-card)',
      borderRadius: 14,
      padding: '18px 20px',
      borderLeft: `4px solid ${color}`,
      flex: 1,
      minWidth: 140,
    }}>
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

function QuickLink({ to, icon: Icon, label, desc, color }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 14,
        padding: '18px 20px',
        border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'transform .15s, box-shadow .15s',
        cursor: 'pointer',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
      </div>
    </Link>
  )
}

export function DashboardSetor() {
  const { sigla } = useParams()
  const { user }  = useAuth()
  const room      = user?.coordinator_room

  const [stats, setStats] = useState(null)
  const COMP = currentCompetencia()

  const load = useCallback(async () => {
    if (!room?.id) return
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [locsRes, confRes, recentRes] = await Promise.all([
      supabase
        .from('equipment_locations')
        .select('equipment_id', { count: 'exact' })
        .eq('current_room_id', room.id),
      supabase
        .from('room_conferences')
        .select('id, competencia, concluded_at, conference_items(status)')
        .eq('room_id', room.id)
        .order('competencia', { ascending: false })
        .limit(5),
      supabase
        .from('asset_movements')
        .select('id', { count: 'exact', head: true })
        .eq('destination_room_id', room.id)
        .gte('moved_at', sevenDaysAgo)
        .is('deleted_at', null),
    ])

    const totalEq   = locsRes.count ?? 0
    const confs     = confRes.data || []
    const thisMonth = confs.find((c) => c.competencia === COMP)
    const lastConf  = confs[0]
    const recentIn  = recentRes.count ?? 0

    // Problema count requires enriching with equipment status
    let problemCount = 0
    if (locsRes.data && locsRes.data.length > 0) {
      const eqIds = [...new Set(locsRes.data.map((l) => l.equipment_id).filter(Boolean))]
      if (eqIds.length > 0) {
        const { count } = await supabase
          .from('equipment')
          .select('id', { count: 'exact', head: true })
          .in('id', eqIds)
          .in('status', ['inservível', 'com defeito'])
        problemCount = count ?? 0
      }
    }

    setStats({ totalEq, problemCount, thisMonth, lastConf, recentIn })
  }, [room?.id, COMP])

  useEffect(() => { load() }, [load])

  if (!room) return <SkeletonTable />

  const sl = sigla?.toLowerCase() || room.sigla?.toLowerCase() || ''

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Painel — {sigla?.toUpperCase()}</h2>
          <p>Olá, {user?.full_name?.split(' ')[0] || 'Coordenador'}! Aqui está o resumo da sua sala.</p>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{room.name}</div>
      </div>

      {!stats ? (
        <SkeletonTable />
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard
              icon={Package}
              label="Equipamentos"
              value={stats.totalEq}
              sub="registrados na sala"
              color="#6366f1"
              bg="rgba(99,102,241,.06)"
            />
            <StatCard
              icon={AlertTriangle}
              label="Com problema"
              value={stats.problemCount}
              sub={stats.problemCount > 0 ? 'precisam de atenção' : 'todos funcionando'}
              color={stats.problemCount > 0 ? '#dc2626' : '#059669'}
              bg={stats.problemCount > 0 ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)'}
            />
            <StatCard
              icon={stats.thisMonth ? CalendarCheck : CalendarX}
              label="Conferência"
              value={stats.thisMonth ? 'OK' : 'Pendente'}
              sub={stats.thisMonth
                ? `Realizada em ${fmtDate(stats.thisMonth.concluded_at)}`
                : `${compLabel(COMP)} ainda não conferido`}
              color={stats.thisMonth ? '#059669' : '#d97706'}
              bg={stats.thisMonth ? 'rgba(16,185,129,.06)' : 'rgba(245,158,11,.06)'}
            />
            <StatCard
              icon={ArrowDownToLine}
              label="Entradas (7 dias)"
              value={stats.recentIn}
              sub="equipamentos recebidos"
              color="#2563eb"
              bg="rgba(59,130,246,.06)"
            />
          </div>

          {/* Último resultado de conferência */}
          {stats.lastConf && (
            <div className="table-card fade-in" style={{ padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
                Última conferência
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>
                    {compLabel(stats.lastConf.competencia)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Concluído em {fmtDate(stats.lastConf.concluded_at)}
                  </div>
                </div>
                {(() => {
                  const items = stats.lastConf.conference_items || []
                  const ok = items.filter((i) => i.status === 'ok').length
                  const prob = items.filter((i) => i.status !== 'ok').length
                  return (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(16,185,129,.1)', color: '#059669', fontSize: 13, fontWeight: 600 }}>✓ {ok} ok</span>
                      {prob > 0 && <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,.1)', color: '#d97706', fontSize: 13, fontWeight: 600 }}>⚠ {prob} problema{prob !== 1 ? 's' : ''}</span>}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Quick links */}
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Acesso rápido
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <QuickLink to={`/setor/${sl}/inventario`} icon={LayoutGrid} label="Inventário da Sala" desc="Veja todos os equipamentos registrados nesta sala" color="#6366f1" />
            <QuickLink to={`/setor/${sl}/movimentacoes`} icon={ArrowRightLeft} label="Movimentações" desc="Histórico de entradas e saídas de equipamentos" color="#2563eb" />
            <QuickLink to={`/setor/${sl}/conferencias`} icon={ClipboardList} label="Conferências Mensais" desc={stats.thisMonth ? `${compLabel(COMP)} já conferido` : `${compLabel(COMP)} pendente`} color={stats.thisMonth ? '#059669' : '#d97706'} />
          </div>
        </>
      )}
    </>
  )
}
