import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, AlertTriangle, XCircle,
  Package, AlertCircle, ChevronLeft, CalendarCheck,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useAudit } from '../hooks/useAudit.js'
import { formatAssetNumber, fmtDate } from '../utils/format.js'
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

function ConferenceCard({ conf, onDelete, deleting }) {
  const summary = summarize(conf.conference_items || [])
  const total = (conf.conference_items || []).length
  return (
    <div className="table-card fade-in" style={{ padding: '16px 20px' }}>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <SummaryChip label="Ok"          value={summary.ok}           color="#059669" bg="rgba(16,185,129,.08)" />
            <SummaryChip label="Ausente"     value={summary.ausente}      color="#dc2626" bg="rgba(239,68,68,.08)" />
            <SummaryChip label="Com Problema" value={summary.com_problema} color="#d97706" bg="rgba(245,158,11,.08)" />
          </div>
          <button
            type="button"
            className="btn-table-action delete"
            onClick={() => onDelete?.(conf)}
            disabled={deleting}
            title="Excluir conferência"
          >
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function StatusBtn({ value, current, onClick }) {
  const cfg = STATUS_CFG[value]
  const active = current === value
  const { Icon } = cfg
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1.5px solid ${active ? cfg.color : 'var(--border-color)'}`,
        background: active ? cfg.bg : 'transparent',
        color: active ? cfg.color : 'var(--text-secondary)',
        transition: 'all .15s',
      }}
    >
      <Icon size={13} /> {cfg.label}
    </button>
  )
}

function ChecklistView({
  sigla, equipment, checklist, generalNotes,
  onGeneralNotes, onStatusChange, onNotesChange,
  onCancel, onSave, saving,
}) {
  const COMP    = currentCompetencia()
  const total   = equipment?.length || 0
  const okCount = Object.values(checklist).filter((v) => v.status === 'ok').length
  const problems = Object.values(checklist).filter((v) => v.status !== 'ok').length

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SummaryChip label="Ok"       value={okCount}  color="#059669" bg="rgba(16,185,129,.08)" />
          <SummaryChip label="Problemas" value={problems} color="#d97706" bg="rgba(245,158,11,.08)" />
        </div>
      </div>

      {!equipment ? (
        <SkeletonTable />
      ) : equipment.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <Package size={40} style={{ opacity: .2, display: 'block', margin: '0 auto 12px' }} />
          <p>Nenhum equipamento registrado nesta sala para conferir.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {equipment.map((eq) => {
            const item = checklist[eq.key] || { status: 'ok', notes: '' }
            const cfg  = STATUS_CFG[item.status]
            return (
              <div
                key={eq.key}
                className="table-card fade-in"
                style={{ padding: '14px 18px', borderLeft: `3px solid ${cfg.color}`, transition: 'border-color .2s' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{eq.equipment_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {eq.categoria && <span>{eq.categoria}</span>}
                      {eq.asset_number && <span>Patr. {formatAssetNumber(eq.asset_number)}</span>}
                      {eq.serial_number && <span>S/N {eq.serial_number}</span>}
                    </div>
                    {eq.received_by && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Responsável: {eq.received_by}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                      style={{ fontSize: 13, padding: '7px 10px' }}
                    />
                  </div>
                )}
              </div>
            )
          })}

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
  const { sigla }           = useParams()
  const { user }            = useAuth()
  const { showToast, confirm } = useToast()
  const audit                = useAudit()
  const room                = user?.coordinator_room

  const [conferences, setConferences]   = useState(null)
  const [loadError, setLoadError]       = useState(null)
  const [mode, setMode]                 = useState('history')
  const [equipment, setEquipment]       = useState(null)
  const [checklist, setChecklist]       = useState({})
  const [generalNotes, setGeneralNotes] = useState('')
  const [saving, setSaving]             = useState(false)
  const [deletingId, setDeletingId]     = useState(null)

  const COMP = currentCompetencia()

  const loadConferences = useCallback(async () => {
    if (!room?.id) return
    setConferences(null)
    setLoadError(null)
    const { data, error } = await supabase
      .from('room_conferences')
      .select('id, competencia, concluded_at, notes, conference_items(id, status)')
      .eq('room_id', room.id)
      .order('competencia', { ascending: false })
    if (error) { setLoadError(error.message); setConferences([]); return }
    setConferences(data || [])
  }, [room?.id])

  useEffect(() => { loadConferences() }, [loadConferences])

  const loadEquipment = useCallback(async () => {
    if (!room?.id) return
    setEquipment(null)
    const { data: locs, error } = await supabase
      .from('equipment_locations')
      .select('asset_number, serial_number, equipment_id, received_by')
      .eq('current_room_id', room.id)

    if (error) { showToast('Erro ao carregar equipamentos: ' + error.message, 'danger'); return }
    if (!locs?.length) { setEquipment([]); return }

    const eqIds = [...new Set(locs.map((l) => l.equipment_id).filter(Boolean))]
    const { data: eqs } = eqIds.length
      ? await supabase.from('equipment').select('id, name, categoria').in('id', eqIds)
      : { data: [] }
    const eqMap = Object.fromEntries((eqs || []).map((e) => [e.id, e]))

    const items = locs.map((loc, i) => ({
      key:            loc.asset_number || loc.serial_number || loc.equipment_id || String(i),
      asset_number:   loc.asset_number  || null,
      serial_number:  loc.serial_number || null,
      received_by:    loc.received_by   || null,
      equipment_name: eqMap[loc.equipment_id]?.name     || '—',
      categoria:      eqMap[loc.equipment_id]?.categoria || null,
    }))

    setEquipment(items)
    setChecklist(Object.fromEntries(items.map((it) => [it.key, { status: 'ok', notes: '' }])))
  }, [room?.id, showToast])

  const startChecklist = () => {
    setGeneralNotes('')
    loadEquipment()
    setMode('checklist')
  }

  const setItemStatus = (key, status) =>
    setChecklist((prev) => ({ ...prev, [key]: { ...prev[key], status } }))

  const setItemNotes = (key, notes) =>
    setChecklist((prev) => ({ ...prev, [key]: { ...prev[key], notes } }))

  const saveConference = async () => {
    if (!room?.id || !equipment) return
    setSaving(true)
    try {
      const { data: conf, error: confErr } = await supabase
        .from('room_conferences')
        .insert({
          room_id:        room.id,
          coordinator_id: user.id,
          competencia:    COMP,
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
      title: 'Excluir conferencia',
      message: `Tem certeza que deseja excluir a conferencia de ${compLabel(conf.competencia)}? Os itens e ocorrencias vinculados tambem serao removidos.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return

    setDeletingId(conf.id)
    const { error } = await supabase
      .from('room_conferences')
      .delete()
      .eq('id', conf.id)
      .eq('room_id', room.id)

    if (error) {
      showToast('Erro ao excluir conferencia: ' + error.message, 'danger')
      setDeletingId(null)
      return
    }

    audit.deleted('room_conferences', conf.id, {
      room_id: room.id,
      room_sigla: sigla,
      competencia: conf.competencia,
      items_count: conf.conference_items?.length || 0,
    })
    showToast('Conferência excluída com sucesso.', 'success')
    setDeletingId(null)
    loadConferences()
  }

  const thisMonthConf = conferences?.find((c) => c.competencia === COMP)
  const history       = conferences?.filter((c) => c.competencia !== COMP) || []

  if (!room) return <SkeletonTable />

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
        onCancel={() => setMode('history')}
        onSave={saveConference}
        saving={saving}
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
                  <button
                    type="button"
                    className="btn-table-action delete"
                    onClick={() => deleteConference(thisMonthConf)}
                    disabled={deletingId === thisMonthConf.id}
                    title="Excluir conferência"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )
            })()}
          </div>
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
