import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'

export function Salas() {
  const { search } = useOutletContext()
  const { invalidate } = useStore()
  const { showToast, confirm } = useToast()
  const audit = useAudit()
  const [salas, setSalas] = useState(null)
  const [sortOrder, setSortOrder] = useState('nome')
  const [createOpen, setCreateOpen] = useState(false)
  const [editSala, setEditSala] = useState(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .is('deleted_at', null)
      .order('name')
    if (error) {
      showToast(error.message, 'danger')
      return
    }
    setSalas(data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const sorted = useMemo(() => {
    if (!salas) return []
    const arr = [...salas]
    if (sortOrder === 'numero') {
      arr.sort((a, b) => {
        if (!a.room_number && !b.room_number) return 0
        if (!a.room_number) return 1
        if (!b.room_number) return -1
        return a.room_number.localeCompare(b.room_number, 'pt-BR', { numeric: true })
      })
    } else {
      arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    }
    return arr
  }, [salas, sortOrder])

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    if (!q) return sorted
    return sorted.filter((s) =>
      [s.name, s.room_number, s.coordinator, s.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [sorted, search])

  const onDelete = async (id) => {
    const sala = salas.find((s) => s.id === id)
    const ok = await confirm({
      title: 'Excluir sala',
      message: `Tem certeza que deseja excluir a sala${sala ? ` "${sala.name}"` : ''}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase
      .from('rooms')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) {
      showToast('Erro ao excluir: ' + error.message, 'danger')
      return
    }
    audit.deleted('rooms', id, { name: sala?.name })
    showToast('Sala excluída.', 'success')
    invalidate('rooms', 'roomsFull')
    await load()
  }

  if (!salas) return <SkeletonTable />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Gestão de Salas</h2>
          <p>Cadastre os ambientes onde os chamados podem ocorrer.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Cadastrar Sala
        </button>
      </div>
      <div className="filter-bar fade-in">
        <div className="filter-row" style={{ justifyContent: 'flex-end' }}>
          <div className="filter-group" style={{ flex: 0, minWidth: 210 }}>
            <label className="filter-label">Ordenar por</label>
            <select
              className="form-control filter-control"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="nome">Nome (A–Z)</option>
              <option value="numero">Nº da Sala (crescente)</option>
            </select>
          </div>
        </div>
      </div>
      <div className="table-card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Nome do Local</th>
              <th>Coordenador</th>
              <th>Descrição / Setor</th>
              <th>Status</th>
              <th style={{ width: 130 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}
                >
                  Nenhuma sala cadastrada no sistema.
                </td>
              </tr>
            ) : (
              filtered.map((sala) => (
                <tr key={sala.id}>
                  <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {sala.room_number || '—'}
                  </td>
                  <td>
                    <strong>{sala.name}</strong>
                  </td>
                  <td>
                    {sala.coordinator || (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {sala.description || (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge-status ${
                        sala.status ? sala.status.toLowerCase().replace(/\s+/g, '_') : 'ativa'
                      }`}
                    >
                      {sala.status || 'Ativa'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-table-action edit" onClick={() => setEditSala(sala)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button className="btn-table-action delete" onClick={() => onDelete(sala.id)}>
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
        <SalaModal
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false)
            invalidate('rooms', 'roomsFull')
            await load()
          }}
        />
      )}
      {editSala && (
        <SalaModal
          sala={editSala}
          onClose={() => setEditSala(null)}
          onSaved={async () => {
            setEditSala(null)
            invalidate('rooms', 'roomsFull')
            await load()
          }}
        />
      )}
    </>
  )
}

function SalaModal({ sala, onClose, onSaved }) {
  const { showToast } = useToast()
  const audit = useAudit()
  const editing = !!sala
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(sala?.name || '')
  const [number, setNumber] = useState(sala?.room_number || '')
  const [coordinator, setCoordinator] = useState(sala?.coordinator || '')
  const [description, setDescription] = useState(sala?.description || '')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const updates = {
      name,
      description,
      room_number: number || null,
      coordinator: coordinator || null,
    }
    if (editing) {
      const { error } = await supabase.from('rooms').update(updates).eq('id', sala.id)
      if (error) {
        showToast('Erro ao atualizar: ' + error.message, 'danger')
        setBusy(false)
        return
      }
      audit.updated('rooms', sala.id, updates)
      showToast('Sala atualizada!', 'success')
      onSaved()
    } else {
      const { data: inserted, error } = await supabase
        .from('rooms')
        .insert([updates])
        .select('id')
        .single()
      if (error) {
        showToast('Erro ao criar sala: ' + error.message, 'danger')
        setBusy(false)
        return
      }
      audit.created('rooms', inserted?.id, { name })
      showToast('Sala cadastrada!', 'success')
      onSaved()
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editing ? 'Editar Local' : 'Cadastrar Novo Local'}</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>
              Nome do Local / Sala <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: Sala de Reuniões"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-2col">
            <div className="form-group">
              <label>
                Número da Sala{' '}
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(Opcional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: 101"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>
                Coordenador{' '}
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(Opcional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: João Silva"
                value={coordinator}
                onChange={(e) => setCoordinator(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>
              Descrição / Setor{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(Opcional)</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: Setor Administrativo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#e2e8f0', color: '#475569' }}
              onClick={onClose}
            >
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
