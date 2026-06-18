import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Package, AlertTriangle, CalendarCheck, ArrowDownToLine,
  LayoutGrid, ArrowRightLeft, ClipboardList, ChevronRight, CalendarX, X,
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

function NewMovementsModal({ movements, onClose, onViewDetails }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content fade-in" style={{ maxWidth: 500, padding: 0, overflow: 'hidden' }}>

        {/* Header colorido */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          padding: '24px 24px 22px',
          position: 'relative',
        }}>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              color: 'rgba(255,255,255,.8)',
              background: 'rgba(255,255,255,.15)',
              border: 'none',
              borderRadius: 8,
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
          <div style={{
            width: 50, height: 50, borderRadius: 14,
            background: 'rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Package size={24} style={{ color: '#fff' }} />
          </div>
          <h3 style={{ color: '#fff', margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
            Novidades na sua sala!
          </h3>
          <p style={{ color: 'rgba(255,255,255,.8)', margin: 0, fontSize: 13, lineHeight: 1.4 }}>
            {movements.length} equipamento{movements.length !== 1 ? 's' : ''}{' '}
            {movements.length !== 1 ? 'foram recebidos' : 'foi recebido'} desde sua última visita
          </p>
        </div>

        {/* Lista de equipamentos */}
        <div style={{ padding: '16px 20px', maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {movements.map((mov, i) => (
            <div
              key={mov.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                animation: `fadeIn .25s ease ${i * 40}ms both`,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(99,102,241,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Package size={18} style={{ color: '#6366f1' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mov.equipment?.name || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {mov.asset_number ? `PAT ${mov.asset_number.toString().padStart(6, '0')} · ` : ''}
                  {fmtDate(mov.moved_at)}
                </div>
              </div>
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700,
                padding: '3px 9px', borderRadius: 20,
                background: 'rgba(99,102,241,.1)', color: '#6366f1',
                textTransform: 'uppercase', letterSpacing: '.05em',
              }}>
                Novo
              </span>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '14px 20px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            OK, ciente
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onViewDetails}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowRightLeft size={14} />
            Ver movimentações
          </button>
        </div>
      </div>
    </div>
  )
}

export function DashboardSetor() {
  const { sigla } = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const room      = user?.coordinator_room

  const [stats, setStats] = useState(null)
  const [newMovements, setNewMovements] = useState(null)
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

  useEffect(() => {
    if (!room?.id || !user?.id) return
    let cancelled = false
    const key = `coord_last_seen_${user.id}_${room.id}`
    const since = localStorage.getItem(key)
      || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    supabase
      .from('equipment_locations')
      .select('id, moved_at, asset_number, equipment_id, equipment(name)')
      .eq('current_room_id', room.id)
      .gte('moved_at', since)
      .order('moved_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return
        setNewMovements(data)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [room?.id, user?.id])

  const dismissNewMovements = useCallback((andNavigate = false) => {
    if (room?.id && user?.id) {
      localStorage.setItem(`coord_last_seen_${user.id}_${room.id}`, new Date().toISOString())
    }
    setNewMovements(null)
    if (andNavigate) {
      const path = sigla?.toLowerCase() || room?.sigla?.toLowerCase() || ''
      navigate(`/setor/${path}/movimentacoes`)
    }
  }, [room?.id, room?.sigla, user?.id, navigate, sigla])

  if (!room) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
      <AlertTriangle size={40} style={{ opacity: .2, display: 'block', margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nenhuma sala vinculada</h3>
      <p style={{ fontSize: 13, maxWidth: 320, margin: '0 auto' }}>
        Sua conta não está associada a nenhuma sala. Contate o administrador para configurar seu acesso.
      </p>
    </div>
  )

  const sl = sigla?.toLowerCase() || room.sigla?.toLowerCase() || ''

  return (
    <>
      {newMovements?.length > 0 && (
        <NewMovementsModal
          movements={newMovements}
          onClose={() => dismissNewMovements(false)}
          onViewDetails={() => dismissNewMovements(true)}
        />
      )}
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

          {/* CTA: conferência do mês pendente */}
          {!stats.thisMonth && (
            <div className="fade-in" style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CalendarX size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#b45309' }}>Conferência de {compLabel(COMP)} pendente</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Realize a conferência mensal para manter o inventário atualizado.</div>
                </div>
              </div>
              <Link to={`/setor/${sl}/conferencias`} className="btn btn-primary" style={{ fontSize: 12, textDecoration: 'none', flexShrink: 0 }}>
                Conferir agora
              </Link>
            </div>
          )}

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
