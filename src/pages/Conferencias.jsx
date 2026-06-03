import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, AlertTriangle, XCircle, CalendarCheck,
  CalendarX, Download, RefreshCw, X, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { fmtDate, fmtDateTime } from '../utils/format.js'

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function compLabel(comp) {
  if (!comp) return '—'
  const [y, m] = comp.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

const OCC_BADGE = {
  ausente:      { label: 'Ausente',      color: '#dc2626', bg: 'rgba(239,68,68,.12)',  Icon: XCircle },
  com_problema: { label: 'Com Problema', color: '#d97706', bg: 'rgba(245,158,11,.12)', Icon: AlertTriangle },
}

function OccTypeBadge({ type }) {
  const cfg = OCC_BADGE[type]
  if (!cfg) return null
  const { Icon } = cfg
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, color: cfg.color,
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>
      <Icon size={11} /> {cfg.label}
    </span>
  )
}

// ─── Aba Visão Geral ──────────────────────────────────────────────────────────

function VisaoGeral({ reloadToken }) {
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const COMP = currentCompetencia()

  const load = useCallback(async () => {
    setData(null)
    const [{ data: rooms, error: rErr }, { data: confs }, { data: lastConfs }] = await Promise.all([
      supabase
        .from('rooms')
        .select('id, name, sigla, coordinator_id, coordinator:profiles!coordinator_id(full_name)')
        .not('coordinator_id', 'is', null)
        .is('deleted_at', null)
        .order('name'),
      supabase
        .from('room_conferences')
        .select('room_id, concluded_at, conference_items(id, status)')
        .eq('competencia', COMP),
      supabase
        .from('room_conferences')
        .select('room_id, competencia, concluded_at')
        .order('competencia', { ascending: false }),
    ])

    if (rErr) { showToast(rErr.message, 'danger'); return }

    const confMap = Object.fromEntries((confs || []).map((c) => [c.room_id, c]))

    // Pega a última conferência por sala (exceto a do mês atual)
    const lastMap = {}
    for (const c of (lastConfs || [])) {
      if (c.competencia === COMP) continue
      if (!lastMap[c.room_id]) lastMap[c.room_id] = c
    }

    setData((rooms || []).map((r) => {
      const thisMonth = confMap[r.id] || null
      const items = thisMonth?.conference_items || []
      const summary = items.reduce(
        (acc, it) => { acc[it.status] = (acc[it.status] || 0) + 1; return acc },
        { ok: 0, ausente: 0, com_problema: 0 },
      )
      return {
        ...r,
        coordinator_name: r.coordinator?.full_name || '—',
        thisMonth,
        summary,
        lastConf: lastMap[r.id] || null,
      }
    }))
  }, [COMP, showToast])

  useEffect(() => { load() }, [load, reloadToken])

  const exportExcel = async () => {
    if (!data) return
    try {
      const xlsxMod = await import('xlsx')
      const XLSX = xlsxMod.default?.utils ? xlsxMod.default : xlsxMod
      const rows = data.map((r) => [
        r.name,
        r.sigla || '—',
        r.coordinator_name,
        r.thisMonth ? 'Conferida' : 'Pendente',
        r.thisMonth ? fmtDate(r.thisMonth.concluded_at) : '—',
        r.summary?.ok ?? 0,
        r.summary?.ausente ?? 0,
        r.summary?.com_problema ?? 0,
        r.lastConf ? compLabel(r.lastConf.competencia) : '—',
      ])
      const ws = XLSX.utils.aoa_to_sheet([
        ['Sala', 'Sigla', 'Coordenador', 'Status', 'Data Conferência', 'Ok', 'Ausente', 'Com Problema', 'Última Anterior'],
        ...rows,
      ])
      ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 18 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Conferências')
      XLSX.writeFile(wb, `conferencias_${COMP}.xlsx`)
      showToast('Exportado com sucesso', 'success')
    } catch (err) {
      showToast('Erro ao exportar: ' + err.message, 'danger')
    }
  }

  if (!data) return <SkeletonTable />

  const total    = data.length
  const conferidas = data.filter((r) => r.thisMonth).length
  const pendentes  = total - conferidas

  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <Chip label="Setores com coordenador" value={total}      color="#6366f1" bg="rgba(99,102,241,.08)" />
        <Chip label="Conferidos no mês"       value={conferidas} color="#059669" bg="rgba(16,185,129,.08)" />
        <Chip label="Pendentes"               value={pendentes}  color="#dc2626" bg="rgba(239,68,68,.08)" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn btn-secondary" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      <div className="table-card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sala / Setor</th>
              <th>Coordenador</th>
              <th>Status ({compLabel(COMP)})</th>
              <th>Data conferência</th>
              <th>Ok / Ausente / Problema</th>
              <th>Última anterior</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  {r.sigla && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.sigla}</div>}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.coordinator_name}</td>
                <td>
                  {r.thisMonth ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 700, fontSize: 12 }}>
                      <CalendarCheck size={13} /> Conferida
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#dc2626', fontWeight: 700, fontSize: 12 }}>
                      <CalendarX size={13} /> Pendente
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {r.thisMonth ? fmtDate(r.thisMonth.concluded_at) : '—'}
                </td>
                <td style={{ fontSize: 12 }}>
                  {r.thisMonth ? (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#059669', fontWeight: 700 }}>{r.summary.ok}</span>
                      {' / '}
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>{r.summary.ausente}</span>
                      {' / '}
                      <span style={{ color: '#d97706', fontWeight: 700 }}>{r.summary.com_problema}</span>
                    </span>
                  ) : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {r.lastConf ? compLabel(r.lastConf.competencia) : 'Nenhuma'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Aba Ocorrências ──────────────────────────────────────────────────────────

function ModalResolve({ occurrence, onClose, onResolved }) {
  const { showToast } = useToast()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const resolve = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('conference_occurrences')
      .update({
        status:           'resolvida',
        resolved_at:      new Date().toISOString(),
        resolution_notes: notes.trim() || null,
      })
      .eq('id', occurrence.id)

    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'danger'); return }
    showToast('Ocorrência marcada como resolvida.', 'success')
    onResolved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 480, width: '95vw' }}>
        <div className="modal-header">
          <h3>Resolver ocorrência</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700 }}>{occurrence.equipment_name || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {occurrence.room_name} · <OccTypeBadge type={occurrence.occurrence_type} />
          </div>
          {occurrence.description && (
            <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              "{occurrence.description}"
            </div>
          )}
        </div>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
          Notas de resolução (opcional)
        </label>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Descreva como foi resolvido..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ fontSize: 13, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={resolve} disabled={saving}>
            {saving ? 'Salvando…' : 'Marcar como resolvida'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Ocorrencias({ reloadToken, onCountChange }) {
  const [list, setList]     = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [resolving, setResolving] = useState(null)
  const [tab, setTab]       = useState('abertas')

  const load = useCallback(async () => {
    setList(null)
    setLoadError(null)
    const { data, error } = await supabase
      .from('conference_occurrences')
      .select(`
        id, occurrence_type, description, status, created_at,
        equipment_name, asset_number,
        resolved_at, resolution_notes,
        room:rooms(name, sigla),
        resolved_by_profile:profiles!resolved_by(full_name),
        conference:room_conferences(competencia)
      `)
      .order('created_at', { ascending: false })

    if (error) { setLoadError(error.message); setList([]); return }

    const rows = (data || []).map((o) => ({
      ...o,
      room_name: o.room?.sigla || o.room?.name || '—',
      resolved_by_name: o.resolved_by_profile?.full_name || null,
      competencia: o.conference?.competencia || null,
    }))

    setList(rows)
    onCountChange?.(rows.filter((r) => r.status === 'aberta').length)
  }, [onCountChange])

  useEffect(() => { load() }, [load, reloadToken])

  const shown = useMemo(() => {
    if (!list) return []
    return list.filter((o) => tab === 'abertas' ? o.status === 'aberta' : o.status === 'resolvida')
  }, [list, tab])

  const abertas   = list?.filter((o) => o.status === 'aberta').length ?? 0
  const resolvidas = list?.filter((o) => o.status === 'resolvida').length ?? 0

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'abertas',    label: `Abertas (${abertas})`,       color: '#dc2626' },
          { key: 'resolvidas', label: `Resolvidas (${resolvidas})`, color: '#059669' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'all .15s',
              border: tab === t.key ? `1.5px solid ${t.color}` : '1.5px solid var(--border-color)',
              background: tab === t.key ? (t.key === 'abertas' ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)') : 'transparent',
              color: tab === t.key ? t.color : 'var(--text-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadError && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,.07)', display: 'flex', gap: 8, marginBottom: 16 }}>
          <AlertCircle size={15} style={{ color: '#dc2626' }} />
          <span style={{ fontSize: 13, color: '#dc2626' }}>{loadError}</span>
        </div>
      )}

      {!list ? (
        <SkeletonTable />
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          {tab === 'abertas' ? 'Nenhuma ocorrência aberta.' : 'Nenhuma ocorrência resolvida.'}
        </div>
      ) : (
        <div className="table-card fade-in">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>Tipo</th>
                <th>Setor</th>
                <th>Mês</th>
                <th>Descrição</th>
                <th>Data</th>
                {tab === 'abertas'    && <th></th>}
                {tab === 'resolvidas' && <th>Resolução</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.equipment_name || '—'}</strong>
                    {o.asset_number && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Patr. {o.asset_number}</div>
                    )}
                  </td>
                  <td><OccTypeBadge type={o.occurrence_type} /></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{o.room_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {o.competencia ? compLabel(o.competencia) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 200 }}>
                    {o.description || <span style={{ fontStyle: 'italic' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {fmtDate(o.created_at)}
                  </td>
                  {tab === 'abertas' && (
                    <td>
                      <button
                        className="btn-table-action"
                        style={{ color: '#059669', gap: 5, whiteSpace: 'nowrap' }}
                        onClick={() => setResolving(o)}
                      >
                        <CheckCircle2 size={14} /> Resolver
                      </button>
                    </td>
                  )}
                  {tab === 'resolvidas' && (
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {o.resolution_notes
                        ? <span title={o.resolution_notes}>{o.resolution_notes.slice(0, 40)}{o.resolution_notes.length > 40 ? '…' : ''}</span>
                        : <span style={{ fontStyle: 'italic' }}>sem notas</span>
                      }
                      {o.resolved_by_name && (
                        <div style={{ fontSize: 11 }}>por {o.resolved_by_name} · {fmtDate(o.resolved_at)}</div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resolving && (
        <ModalResolve
          occurrence={resolving}
          onClose={() => setResolving(null)}
          onResolved={load}
        />
      )}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Chip({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '8px 14px', borderLeft: `3px solid ${color}`, minWidth: 100 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{label}</div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function Conferencias() {
  const [tab, setTab]           = useState('geral')
  const [reloadToken, setReloadToken] = useState(0)
  const [openCount, setOpenCount]     = useState(0)
  const refresh = () => setReloadToken((t) => t + 1)

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Conferências de Setores</h2>
          <p>Acompanhe o status das conferências mensais de cada coordenador.</p>
        </div>
        <button className="btn btn-secondary" onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 0 }}>
        {[
          { key: 'geral',       label: 'Visão Geral' },
          { key: 'ocorrencias', label: openCount > 0 ? `Ocorrências (${openCount} abertas)` : 'Ocorrências' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: tab === t.key ? 'var(--primary-color)' : 'var(--text-secondary)',
              marginBottom: -1, transition: 'color .15s',
            }}
          >
            {t.label}
            {t.key === 'ocorrencias' && openCount > 0 && (
              <span style={{
                marginLeft: 6, background: '#dc2626', color: '#fff',
                borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700,
              }}>
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'geral' && <VisaoGeral reloadToken={reloadToken} />}
      {tab === 'ocorrencias' && <Ocorrencias reloadToken={reloadToken} onCountChange={setOpenCount} />}
    </>
  )
}
