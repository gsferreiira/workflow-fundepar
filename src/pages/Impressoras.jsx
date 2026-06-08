import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, Pencil, Trash2, Loader2, Printer } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { fmtDateTime } from '../utils/format.js'

const STATUS_OPTIONS = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'inativa', label: 'Inativa' },
  { value: 'manutencao', label: 'Manutenção' },
]

function statusLabel(value) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label || value || '—'
}

function normalizePercent(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return Math.min(100, Math.max(0, parsed))
}

function PercentCell({ value }) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--text-secondary)' }}>—</span>
  }
  return <strong>{value}%</strong>
}

function roomLabel(room) {
  if (!room) return '—'
  return [room.room_number, room.name].filter(Boolean).join(' - ') || room.name || '—'
}

export function Impressoras() {
  const { search, registerRefresh } = useOutletContext()
  const { rooms: roomsFetcher } = useStore()
  const { showToast, showUndoToast, confirm } = useToast()
  const audit = useAudit()
  const [printers, setPrinters] = useState(null)
  const [rooms, setRooms] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editPrinter, setEditPrinter] = useState(null)
  const [searchLocal, setSearchLocal] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const loadRef = useRef(null)

  const load = async () => {
    const [{ data, error }, roomList] = await Promise.all([
      supabase
        .from('printers')
        .select('*, room:room_id(id, name, room_number, sigla)')
        .is('deleted_at', null)
        .order('hostname'),
      roomsFetcher(),
    ])
    if (error) {
      showToast('Erro ao carregar impressoras: ' + error.message, 'danger')
      return
    }
    setPrinters(data || [])
    setRooms(roomList || [])
  }
  loadRef.current = load

  useEffect(() => {
    load()
    registerRefresh?.(() => loadRef.current?.())
    return () => registerRefresh?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    if (!printers) return []
    const q = (search || searchLocal).toLowerCase().trim()
    return printers.filter((printer) => {
      if (statusFilter && printer.status !== statusFilter) return false
      if (roomFilter && printer.room_id !== roomFilter) return false
      if (!q) return true
      const hay = [
        printer.hostname,
        printer.ip_address,
        printer.status,
        printer.room?.name,
        printer.room?.room_number,
        printer.room?.sigla,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [printers, roomFilter, search, searchLocal, statusFilter])

  const onDelete = async (id) => {
    const printer = printers.find((item) => item.id === id)
    const ok = await confirm({
      title: 'Excluir impressora',
      message: `Tem certeza que deseja excluir a impressora${printer ? ` "${printer.hostname}"` : ''}?`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return

    const { error } = await supabase
      .from('printers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) {
      showToast('Erro ao excluir impressora: ' + error.message, 'danger')
      return
    }

    audit.deleted('printers', id, { hostname: printer?.hostname })
    await load()
    showUndoToast(`Impressora "${printer?.hostname || 'sem hostname'}" excluída.`, async () => {
      await supabase.from('printers').update({ deleted_at: null }).eq('id', id)
      await load()
    })
  }

  if (!printers) return <SkeletonTable />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Impressoras</h2>
          <p>Cadastre e acompanhe os equipamentos de impressão da Fundepar.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Cadastrar Impressora
        </button>
      </div>

      <div className="filter-bar fade-in">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 2, minWidth: 180 }}>
            <label className="filter-label">Pesquisar</label>
            <input
              type="text"
              className="form-control filter-control"
              placeholder="Hostname, IP ou sala..."
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Sala</label>
            <select className="form-control filter-control" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">Todas</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{roomLabel(room)}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select className="form-control filter-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <span className="filter-count">
            {filtered.length} impressora{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            className="btn-filter-clear"
            onClick={() => {
              setSearchLocal('')
              setStatusFilter('')
              setRoomFilter('')
            }}
          >
            <X size={13} /> Limpar
          </button>
        </div>
      </div>

      <div className="table-card fade-in">
        <table className="data-table" style={{ minWidth: 1040 }}>
          <thead>
            <tr>
              <th>Hostname</th>
              <th>Endereço IP</th>
              <th>Sala Vinculada</th>
              <th>Status</th>
              <th>Toner</th>
              <th>Unidade de Imagem</th>
              <th>Kit de Manutenção</th>
              <th>Data de Atualização</th>
              <th style={{ width: 130 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    icon={Printer}
                    title={search || searchLocal || statusFilter || roomFilter ? 'Nenhuma impressora encontrada' : 'Nenhuma impressora cadastrada'}
                    description={search || searchLocal || statusFilter || roomFilter ? 'Tente ajustar a busca ou os filtros.' : 'Clique em "Cadastrar Impressora" para iniciar.'}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((printer) => (
                <tr key={printer.id}>
                  <td><strong>{printer.hostname}</strong></td>
                  <td>
                    <a
                      href={`http://${printer.ip_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)', fontFamily: 'monospace', fontWeight: 700 }}
                    >
                      {printer.ip_address}
                    </a>
                  </td>
                  <td>{roomLabel(printer.room)}</td>
                  <td>
                    <span className={`badge-status ${printer.status || 'ativa'}`}>
                      {statusLabel(printer.status)}
                    </span>
                  </td>
                  <td><PercentCell value={printer.toner_percent} /></td>
                  <td><PercentCell value={printer.image_unit_percent} /></td>
                  <td><PercentCell value={printer.maintenance_kit_percent} /></td>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {fmtDateTime(printer.updated_at || printer.created_at)}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-table-action edit" onClick={() => setEditPrinter(printer)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button className="btn-table-action delete" onClick={() => onDelete(printer.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <PrinterModal
          rooms={rooms}
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false)
            await load()
          }}
        />
      )}
      {editPrinter && (
        <PrinterModal
          printer={editPrinter}
          rooms={rooms}
          onClose={() => setEditPrinter(null)}
          onSaved={async () => {
            setEditPrinter(null)
            await load()
          }}
        />
      )}
    </>
  )
}

function PrinterModal({ printer, rooms, onClose, onSaved }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const audit = useAudit()
  const editing = !!printer
  const [busy, setBusy] = useState(false)
  const [hostname, setHostname] = useState(printer?.hostname || '')
  const [ipAddress, setIpAddress] = useState(printer?.ip_address || '')
  const [roomId, setRoomId] = useState(printer?.room_id || '')
  const [status, setStatus] = useState(printer?.status || 'ativa')
  const [toner, setToner] = useState(printer?.toner_percent ?? '')
  const [imageUnit, setImageUnit] = useState(printer?.image_unit_percent ?? '')
  const [maintenanceKit, setMaintenanceKit] = useState(printer?.maintenance_kit_percent ?? '')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)

    const updates = {
      hostname: hostname.trim(),
      ip_address: ipAddress.trim(),
      room_id: roomId,
      status,
      toner_percent: normalizePercent(toner),
      image_unit_percent: normalizePercent(imageUnit),
      maintenance_kit_percent: normalizePercent(maintenanceKit),
      updated_by: user?.id || null,
    }

    if (editing) {
      const { error } = await supabase.from('printers').update(updates).eq('id', printer.id)
      if (error) {
        showToast('Erro ao atualizar impressora: ' + error.message, 'danger')
        setBusy(false)
        return
      }
      audit.updated('printers', printer.id, {
        previous: {
          hostname: printer.hostname,
          ip_address: printer.ip_address,
          room_id: printer.room_id,
          status: printer.status,
          toner_percent: printer.toner_percent,
          image_unit_percent: printer.image_unit_percent,
          maintenance_kit_percent: printer.maintenance_kit_percent,
        },
        next: updates,
      })
      showToast('Impressora atualizada!', 'success')
      onSaved()
      return
    }

    const { data: inserted, error } = await supabase
      .from('printers')
      .insert([{ ...updates, created_by: user?.id || null }])
      .select('id')
      .single()
    if (error) {
      showToast('Erro ao cadastrar impressora: ' + error.message, 'danger')
      setBusy(false)
      return
    }
    audit.created('printers', inserted?.id, { hostname: updates.hostname, ip_address: updates.ip_address })
    showToast('Impressora cadastrada!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>{editing ? 'Editar Impressora' : 'Cadastrar Impressora'}</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-2col">
            <div className="form-group">
              <label>Hostname <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="Ex: IMP-DVTI-01"
              />
            </div>
            <div className="form-group">
              <label>Endereço IP <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="Ex: 192.168.0.10"
              />
            </div>
          </div>

          <div className="form-2col">
            <div className="form-group">
              <label>Sala vinculada <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select className="form-control" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Selecione...</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{roomLabel(room)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select className="form-control" required value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-2col">
            <div className="form-group">
              <label>Toner (%)</label>
              <input type="number" min="0" max="100" className="form-control" value={toner} onChange={(e) => setToner(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Unidade de Imagem (%)</label>
              <input type="number" min="0" max="100" className="form-control" value={imageUnit} onChange={(e) => setImageUnit(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Kit de Manutenção (%)</label>
            <input type="number" min="0" max="100" className="form-control" value={maintenanceKit} onChange={(e) => setMaintenanceKit(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : editing ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
