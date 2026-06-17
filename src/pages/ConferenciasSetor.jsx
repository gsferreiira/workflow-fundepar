import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, AlertTriangle, XCircle,
  Package, AlertCircle, ChevronLeft, CalendarCheck,
  Trash2, ChevronDown, ChevronUp, Download, CheckSquare,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useAudit } from '../hooks/useAudit.js'
import { formatAssetNumber, fmtDate } from '../utils/format.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { DOMINIO_ICONS } from '../config/dominios.js'

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function compLabel(comp) {
  if (!comp) return ''
  const [y, m] = comp.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function summarize(items = []) {
  return items.reduce(
    (acc, it) => { acc[it.status] = (acc[it.status] || 0) + 1; return acc },
    { ok: 0, ausente: 0, com_problema: 0 },
  )
}

const STATUS_CFG = {
  ok:           { label: 'Ok',           color: '#059669', bg: 'rgba(16,185,129,.13)', Icon: CheckCircle2 },
  ausente:      { label: 'Ausente',      color: '#dc2626', bg: 'rgba(239,68,68,.13)',  Icon: XCircle },
  com_problema: { label: 'Com Problema', color: '#d97706', bg: 'rgba(245,158,11,.13)', Icon: AlertTriangle },
}

function SummaryChip({ label, value, color, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '8px 14px',
      borderLeft: `3px solid ${color}`, minWidth: 80, textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{label}</div>
    </div>
  )
}

async function exportConference(conf, roomName) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Fundepar TI'
  const ws = wb.addWorksheet('Conferência')

  const titleRow = ws.addRow([`Conferência — ${roomName} — ${compLabel(conf.competencia)}`])
  titleRow.font = { bold: true, size: 13 }
  ws.mergeCells('A1:E1')

  ws.addRow([])

  const headerRow = ws.addRow(['Nº Patrimônio', 'Equipamento', 'Categoria', 'Status', 'Observação'])
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F0FB' } }

  ws.getColumn(1).width = 16
  ws.getColumn(2).width = 32
  ws.getColumn(3).width = 18
  ws.getColumn(4).width = 14
  ws.getColumn(5).width = 40

  for (const item of (conf.conference_items || [])) {
    const row = ws.addRow([
      item.asset_number ? formatAssetNumber(item.asset_number) : '—',
      item.equipment_name || '—',
      item.categoria || '—',
      STATUS_CFG[item.status]?.label || item.status,
      item.notes || '',
    ])
    if (item.status === 'com_problema') {
      row.getCell(4).font = { color: { argb: 'FFD97706' }, bold: true }
    } else if (item.status === 'ausente') {
      row.getCell(4).font = { color: { argb: 'FFDC2626' }, bold: true }
    }
  }

  ws.addRow([])
  const s = summarize(conf.conference_items)
  ws.addRow([`Resumo: ${s.ok} ok · ${s.ausente} ausente(s) · ${s.com_problema} com problema`])
  if (conf.notes) ws.addRow([`Observações gerais: ${conf.notes}`])
  ws.addRow([`Gerado em ${new Date().toLocaleString('pt-BR')}`])

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const a = document.createElement('a')
  a.href = url
  a.download = `conferencia-${conf.competencia}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── ConferenceCard ────────────────────────────────────────────────────────────

function ConferenceCard({ conf, room, onDelete, deleting }) {
  const [expanded, setExpanded]     = useState(false)
  const [exporting, setExporting]   = useState(false)
  const summary = summarize(conf.conference_items || [])
  const total   = (conf.conference_items || []).length
  const items   = conf.conference_items || []

  const handleExport = async () => {
    setExporting(true)
    try { await exportConference(conf, room?.name || '') }
    finally { setExporting(false) }
  }

  return (
    <div className="table-card fade-in" style={{ padding: '16px 20px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>
            {compLabel(conf.competencia)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Conferido em {fmtDate(conf.concluded_at)} · {total} equipamento{total !== 1 ? 's' : ''}
          </div>
          {conf.notes && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
              "{conf.notes}"
            </div>
          )}
        </div>

        <div className="conference-card-actions">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <SummaryChip label="Ok"          value={summary.ok}           color="#059669" bg="rgba(16,185,129,.08)" />
            <SummaryChip label="Ausente"     value={summary.ausente}      color="#dc2626" bg="rgba(239,68,68,.08)" />
            <SummaryChip label="Com Problema" value={summary.com_problema} color="#d97706" bg="rgba(245,158,11,.08)" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn-table-action"
              onClick={handleExport}
              disabled={exporting}
              title="Exportar Excel"
              style={{ color: '#6366f1' }}
            >
              <Download size={13} /> {exporting ? 'Exportando…' : 'Excel'}
            </button>
            <button
              type="button"
              className="btn-table-action"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Recolher itens' : 'Ver itens'}
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? 'Recolher' : 'Ver itens'}
            </button>
            <button
              type="button"
              className="btn-table-action delete"
              onClick={() => onDelete?.(conf)}
              disabled={deleting}
              title="Excluir conferência"
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      </div>

      {expanded && items.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Equipamento</th>
                <th>Nº Patrimônio</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const cfg = STATUS_CFG[it.status]
                return (
                  <tr key={it.id}>
                    <td><strong style={{ fontSize: 13 }}>{it.equipment_name || '—'}</strong></td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {it.asset_number ? formatAssetNumber(it.asset_number) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{it.categoria || '—'}</td>
                    <td>
                      {cfg ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: cfg.bg, color: cfg.color,
                        }}>
                          {cfg.label}
                        </span>
                      ) : it.status}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{it.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── StatusBtn ─────────────────────────────────────────────────────────────────

function StatusBtn({ value, current, onClick }) {
  const cfg    = STATUS_CFG[value]
  const active = current === value
  const { Icon } = cfg
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 18px', borderRadius: 24, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        border: `2px solid ${active ? cfg.color : 'var(--border-color)'}`,
        background: active ? cfg.bg : 'transparent',
        color: active ? cfg.color : 'var(--text-secondary)',
        transition: 'all .15s',
        minWidth: 110,
        justifyContent: 'center',
      }}
    >
      <Icon size={14} /> {cfg.label}
    </button>
  )
}

// ─── ChecklistView ────────────────────────────────────────────────────────────

const DOMAIN_ORDER = ['TI', 'Mobiliário', 'Eletrodoméstico', 'Outros']
const DOMAIN_COLORS = {
  TI:             '#6366f1',
  Mobiliário:     '#059669',
  Eletrodoméstico:'#2563eb',
  Outros:         '#d97706',
}

function DomainSectionHeader({ dominio, items, checklist }) {
  const total    = items.length
  const okCount  = items.filter((eq) => (checklist[eq.key]?.status || 'ok') === 'ok').length
  const problems = total - okCount
  const color    = DOMAIN_COLORS[dominio] || '#6366f1'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 8px', borderBottom: `2px solid ${color}22`, marginBottom: 4, marginTop: 8 }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{DOMINIO_ICONS[dominio] || '📦'}</span>
      <span style={{ fontWeight: 700, fontSize: 15, color }}>{dominio}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>
        {okCount}/{total} ok{problems > 0 ? ` · ${problems} com problema` : ''}
      </span>
    </div>
  )
}

function ChecklistView({
  sigla, equipment, checklist, generalNotes,
  onGeneralNotes, onStatusChange, onNotesChange,
  onCancel, onSave, saving, onMarkAllOk, draftRestored,
}) {
  const COMP     = currentCompetencia()
  const total    = equipment?.length || 0
  const okCount  = Object.values(checklist).filter((v) => v.status === 'ok').length
  const problems = Object.values(checklist).filter((v) => v.status !== 'ok').length
  const okPct    = total ? Math.round((okCount / total) * 100) : 0

  // Group by dominio for visual sections
  const domainGroups = (() => {
    if (!equipment) return []
    const grouped = {}
    for (const eq of equipment) {
      const d = eq.dominio || 'TI'
      if (!grouped[d]) grouped[d] = []
      grouped[d].push(eq)
    }
    return DOMAIN_ORDER.filter((d) => grouped[d]?.length).map((d) => ({ dominio: d, items: grouped[d] }))
  })()
  const multiDomain = domainGroups.length > 1

  return (
    <>
      <div className="view-header">
        <div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 13, padding: '0 0 6px',
            }}
          >
            <ChevronLeft size={15} /> Voltar
          </button>
          <h2 style={{ textTransform: 'capitalize' }}>
            Conferência de {compLabel(COMP)} — {sigla?.toUpperCase()}
          </h2>
          <p>Marque o status de cada equipamento da sala.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <SummaryChip label="Ok"        value={okCount}  color="#059669" bg="rgba(16,185,129,.08)" />
          <SummaryChip label="Problemas" value={problems} color="#d97706" bg="rgba(245,158,11,.08)" />
        </div>
      </div>

      {draftRestored && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)',
          fontSize: 13, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckSquare size={14} />
          Rascunho restaurado — suas marcações anteriores foram recuperadas automaticamente.
        </div>
      )}

      {equipment && equipment.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>{okCount} de {total} com status OK</span>
            <span>{problems > 0 ? `${problems} com problema` : 'Nenhum problema até agora'}</span>
          </div>
          <div style={{ height: 7, borderRadius: 6, background: 'var(--border-color)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${okPct}%`,
              background: problems > 0 ? '#d97706' : '#059669',
              borderRadius: 6,
              transition: 'width .3s ease',
            }} />
          </div>
        </div>
      )}

      {equipment && equipment.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onMarkAllOk}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CheckSquare size={14} /> Marcar todos como OK
          </button>
        </div>
      )}

      {!equipment ? (
        <SkeletonTable />
      ) : equipment.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <Package size={40} style={{ opacity: .2, display: 'block', margin: '0 auto 12px' }} />
          <p>Nenhum equipamento registrado nesta sala para conferir.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {domainGroups.map(({ dominio, items }) => (
            <div key={dominio}>
              {multiDomain && (
                <DomainSectionHeader dominio={dominio} items={items} checklist={checklist} />
              )}
              {items.map((eq) => {
                const item = checklist[eq.key] || { status: 'ok', notes: '' }
                const cfg  = STATUS_CFG[item.status]
                return (
                  <div
                    key={eq.key}
                    className="table-card fade-in"
                    style={{ padding: '16px 18px', borderLeft: `3px solid ${cfg.color}`, transition: 'border-color .2s', marginBottom: 10 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{eq.equipment_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {eq.categoria && <span>{eq.categoria}</span>}
                          {eq.asset_number && <span>Patr. {formatAssetNumber(eq.asset_number)}</span>}
                          {eq.serial_number && <span>S/N {eq.serial_number}</span>}
                        </div>
                        {eq.received_by && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                            Responsável: {eq.received_by}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.keys(STATUS_CFG).map((s) => (
                          <StatusBtn
                            key={s}
                            value={s}
                            current={item.status}
                            onClick={(v) => onStatusChange(eq.key, v)}
                          />
                        ))}
                      </div>
                    </div>
                    {item.status !== 'ok' && (
                      <div style={{ marginTop: 10 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Descreva o problema ou motivo da ausência (opcional)..."
                          value={item.notes}
                          onChange={(e) => onNotesChange(eq.key, e.target.value)}
                          style={{ fontSize: 13, padding: '8px 12px' }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <div className="table-card" style={{ padding: '16px 18px', marginTop: 8 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              Observações gerais (opcional)
            </label>
            <textarea
              className="conference-notes-textarea"
              rows={3}
              placeholder="Alguma observação geral sobre a conferência deste mês..."
              value={generalNotes}
              onChange={(e) => onGeneralNotes(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSave}
                disabled={saving || !equipment}
              >
                {saving ? 'Salvando…' : `Finalizar conferência (${total} itens)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConferenciasSetor() {
  const { sigla }              = useParams()
  const { user }               = useAuth()
  const { showToast, confirm } = useToast()
  const audit                  = useAudit()
  const room                   = user?.coordinator_room

  const [conferences, setConferences]   = useState(null)
  const [loadError, setLoadError]       = useState(null)
  const [mode, setMode]                 = useState('history')
  const [equipment, setEquipment]       = useState(null)
  const [checklist, setChecklist]       = useState({})
  const [generalNotes, setGeneralNotes] = useState('')
  const [saving, setSaving]             = useState(false)
  const [deletingId, setDeletingId]     = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [currentExpanded, setCurrentExpanded] = useState(false)

  const COMP = currentCompetencia()

  const prevMonthComp = useMemo(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const draftKey = room?.id ? `conf_draft_${room.id}_${COMP}` : null

  // Auto-save draft while in checklist mode
  useEffect(() => {
    if (mode !== 'checklist' || !equipment || !draftKey) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ checklist, generalNotes }))
    } catch {
      // localStorage might be full — silently ignore
    }
  }, [checklist, generalNotes, mode, equipment, draftKey])

  const clearDraft = useCallback(() => {
    if (draftKey) localStorage.removeItem(draftKey)
  }, [draftKey])

  const loadConferences = useCallback(async () => {
    if (!room?.id) return
    setConferences(null)
    setLoadError(null)
    const { data, error } = await supabase
      .from('room_conferences')
      .select('id, competencia, concluded_at, notes, conference_items(id, status, asset_number, serial_number, equipment_name, categoria, notes)')
      .eq('room_id', room.id)
      .order('competencia', { ascending: false })
    if (error) { setLoadError(error.message); setConferences([]); return }
    setConferences(data || [])
  }, [room?.id])

  useEffect(() => { loadConferences() }, [loadConferences])

  const loadEquipment = useCallback(async () => {
    if (!room?.id) return
    setEquipment(null)
    setDraftRestored(false)

    const { data: locs, error } = await supabase
      .from('equipment_locations')
      .select('asset_number, serial_number, equipment_id, received_by')
      .eq('current_room_id', room.id)

    if (error) { showToast('Erro ao carregar equipamentos: ' + error.message, 'danger'); return }
    if (!locs?.length) { setEquipment([]); return }

    const eqIds = [...new Set(locs.map((l) => l.equipment_id).filter(Boolean))]
    const { data: eqs } = eqIds.length
      ? await supabase.from('equipment').select('id, name, categoria, dominio').in('id', eqIds)
      : { data: [] }
    const eqMap = Object.fromEntries((eqs || []).map((e) => [e.id, e]))

    const items = locs.map((loc, i) => ({
      key:            loc.asset_number || loc.serial_number || loc.equipment_id || String(i),
      asset_number:   loc.asset_number  || null,
      serial_number:  loc.serial_number || null,
      received_by:    loc.received_by   || null,
      equipment_name: eqMap[loc.equipment_id]?.name     || '—',
      categoria:      eqMap[loc.equipment_id]?.categoria || null,
      dominio:        eqMap[loc.equipment_id]?.dominio   || 'TI',
    }))

    // Attempt to restore draft
    const key = `conf_draft_${room.id}_${currentCompetencia()}`
    const rawDraft = localStorage.getItem(key)
    let restoredChecklist = Object.fromEntries(items.map((it) => [it.key, { status: 'ok', notes: '' }]))
    let restoredNotes = ''
    let restored = false

    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft)
        const currentKeys = new Set(items.map((it) => it.key))
        const draftKeys   = new Set(Object.keys(draft.checklist || {}))
        const keysMatch   = currentKeys.size === draftKeys.size &&
          [...currentKeys].every((k) => draftKeys.has(k))

        if (keysMatch) {
          restoredChecklist = draft.checklist
          restoredNotes     = draft.generalNotes || ''
          restored          = true
        } else {
          localStorage.removeItem(key)
        }
      } catch {
        localStorage.removeItem(key)
      }
    }

    setEquipment(items)
    setChecklist(restoredChecklist)
    setGeneralNotes(restoredNotes)
    setDraftRestored(restored)
  }, [room?.id, showToast])

  const startChecklist = () => {
    setMode('checklist')
    loadEquipment()
  }

  const setItemStatus = (key, status) =>
    setChecklist((prev) => ({ ...prev, [key]: { ...prev[key], status } }))

  const setItemNotes = (key, notes) =>
    setChecklist((prev) => ({ ...prev, [key]: { ...prev[key], notes } }))

  const markAllOk = () =>
    setChecklist((prev) =>
      Object.fromEntries(Object.keys(prev).map((k) => [k, { ...prev[k], status: 'ok' }])),
    )

  const saveConference = async () => {
    if (!room?.id || !equipment) return
    if (conferences?.some((c) => c.competencia === COMP)) {
      showToast('A conferência deste mês já foi realizada.', 'warning')
      setMode('history')
      return
    }
    setSaving(true)
    try {
      const { data: conf, error: confErr } = await supabase
        .from('room_conferences')
        .insert({
          room_id:        room.id,
          coordinator_id: user.id,
          competencia:    COMP,
          concluded_at:   new Date().toISOString(),
          notes:          generalNotes.trim() || null,
        })
        .select('id')
        .single()

      if (confErr) throw confErr

      if (equipment.length > 0) {
        const items = equipment.map((eq) => ({
          conference_id:  conf.id,
          asset_number:   eq.asset_number,
          serial_number:  eq.serial_number,
          equipment_name: eq.equipment_name,
          categoria:      eq.categoria,
          status:         checklist[eq.key]?.status || 'ok',
          notes:          checklist[eq.key]?.notes?.trim() || null,
        }))

        const { data: saved, error: itemsErr } = await supabase
          .from('conference_items')
          .insert(items)
          .select('id, status, asset_number, equipment_name, notes')

        if (itemsErr) throw itemsErr

        const occurrences = (saved || [])
          .filter((it) => it.status !== 'ok')
          .map((it) => ({
            conference_id:      conf.id,
            conference_item_id: it.id,
            room_id:            room.id,
            asset_number:       it.asset_number,
            equipment_name:     it.equipment_name,
            occurrence_type:    it.status,
            description:        it.notes || null,
          }))

        if (occurrences.length > 0) {
          const { error: occErr } = await supabase
            .from('conference_occurrences')
            .insert(occurrences)
          if (occErr) throw occErr
        }
      }

      audit.created('room_conferences', conf.id, {
        room_id: room.id,
        room_sigla: sigla,
        competencia: COMP,
        items_count: equipment.length,
      })
      clearDraft()
      showToast('Conferência finalizada com sucesso!', 'success')
      setMode('history')
      loadConferences()
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, 'danger')
    } finally {
      setSaving(false)
    }
  }

  const deleteConference = async (conf) => {
    if (!room?.id || !conf?.id) return
    const ok = await confirm({
      title: 'Excluir conferência',
      message: `Tem certeza que deseja excluir a conferência de ${compLabel(conf.competencia)}? Os itens e ocorrências vinculados também serão removidos.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return

    setDeletingId(conf.id)
    try {
      const { error } = await supabase
        .from('room_conferences')
        .delete()
        .eq('id', conf.id)
        .eq('room_id', room.id)

      if (error) { showToast('Erro ao excluir conferência: ' + error.message, 'danger'); return }

      audit.deleted('room_conferences', conf.id, {
        room_id: room.id,
        room_sigla: sigla,
        competencia: conf.competencia,
        items_count: conf.conference_items?.length || 0,
      })
      showToast('Conferência excluída com sucesso.', 'success')
      loadConferences()
    } finally {
      setDeletingId(null)
    }
  }

  const thisMonthConf  = conferences?.find((c) => c.competencia === COMP)
  const prevMonthDone  = !conferences || conferences.some((c) => c.competencia === prevMonthComp)
  const history        = conferences?.filter((c) => c.competencia !== COMP) || []

  if (!room) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
      <AlertCircle size={40} style={{ opacity: .2, display: 'block', margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Nenhuma sala vinculada</h3>
      <p style={{ fontSize: 13, maxWidth: 320, margin: '0 auto' }}>
        Sua conta não está associada a nenhuma sala. Contate o administrador para configurar seu acesso.
      </p>
    </div>
  )

  if (mode === 'checklist') {
    return (
      <ChecklistView
        sigla={sigla}
        equipment={equipment}
        checklist={checklist}
        generalNotes={generalNotes}
        onGeneralNotes={setGeneralNotes}
        onStatusChange={setItemStatus}
        onNotesChange={setItemNotes}
        onCancel={() => { clearDraft(); setMode('history') }}
        onSave={saveConference}
        saving={saving}
        onMarkAllOk={markAllOk}
        draftRestored={draftRestored}
      />
    )
  }

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Conferências — {sigla?.toUpperCase()}</h2>
          <p>Histórico de conferências mensais do setor.</p>
        </div>
      </div>

      {!prevMonthDone && (
        <div style={{
          margin: '0 0 20px', padding: '14px 18px', borderRadius: 12,
          background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#92400e' }}>
            <strong>Conferência pendente!</strong> A conferência de{' '}
            <strong style={{ textTransform: 'capitalize' }}>{compLabel(prevMonthComp)}</strong>{' '}
            ainda não foi registrada.
          </span>
        </div>
      )}

      {loadError && (
        <div style={{
          margin: '0 0 20px', padding: '16px 20px', borderRadius: 12,
          background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#dc2626' }}>{loadError}</span>
        </div>
      )}

      {/* Card mês atual */}
      <div className="table-card fade-in" style={{
        padding: '20px 24px', marginBottom: 24,
        borderLeft: `4px solid ${thisMonthConf ? '#059669' : '#d97706'}`,
      }}>
        {thisMonthConf ? (
          <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CalendarCheck size={22} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#059669', textTransform: 'capitalize' }}>
                  {compLabel(COMP)} conferido
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Concluído em {fmtDate(thisMonthConf.concluded_at)}
                </div>
                {thisMonthConf.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                    "{thisMonthConf.notes}"
                  </div>
                )}
              </div>
            </div>
            {(() => {
              const s = summarize(thisMonthConf.conference_items)
              return (
                <div className="conference-card-actions">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <SummaryChip label="Ok"           value={s.ok}           color="#059669" bg="rgba(16,185,129,.08)" />
                    <SummaryChip label="Ausente"      value={s.ausente}      color="#dc2626" bg="rgba(239,68,68,.08)" />
                    <SummaryChip label="Com Problema" value={s.com_problema} color="#d97706" bg="rgba(245,158,11,.08)" />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn-table-action"
                      onClick={async () => {
                        try { await exportConference(thisMonthConf, room?.name || '') }
                        catch { showToast('Erro ao exportar.', 'danger') }
                      }}
                      style={{ color: '#6366f1' }}
                      title="Exportar Excel"
                    >
                      <Download size={13} /> Excel
                    </button>
                    <button
                      type="button"
                      className="btn-table-action"
                      onClick={() => setCurrentExpanded((v) => !v)}
                      title={currentExpanded ? 'Recolher itens' : 'Ver itens'}
                    >
                      {currentExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {currentExpanded ? 'Recolher' : 'Ver itens'}
                    </button>
                    <button
                      type="button"
                      className="btn-table-action delete"
                      onClick={() => deleteConference(thisMonthConf)}
                      disabled={deletingId === thisMonthConf.id}
                      title="Excluir conferência"
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
          {currentExpanded && (thisMonthConf.conference_items || []).length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Equipamento</th>
                    <th>Nº Patrimônio</th>
                    <th>Categoria</th>
                    <th>Status</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {(thisMonthConf.conference_items || []).map((it) => {
                    const cfg = STATUS_CFG[it.status]
                    return (
                      <tr key={it.id}>
                        <td><strong style={{ fontSize: 13 }}>{it.equipment_name || '—'}</strong></td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {it.asset_number ? formatAssetNumber(it.asset_number) : '—'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{it.categoria || '—'}</td>
                        <td>
                          {cfg ? (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                          ) : it.status}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{it.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ClipboardList size={22} style={{ color: '#d97706', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>
                  {compLabel(COMP)} — pendente
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  A conferência deste mês ainda não foi realizada.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startChecklist}
              style={{ whiteSpace: 'nowrap' }}
            >
              Iniciar conferência
            </button>
          </div>
        )}
      </div>

      {/* Histórico */}
      {!conferences ? (
        <SkeletonTable />
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 14 }}>Nenhuma conferência anterior registrada.</p>
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Histórico
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map((conf) => (
              <ConferenceCard
                key={conf.id}
                conf={conf}
                room={room}
                onDelete={deleteConference}
                deleting={deletingId === conf.id}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
