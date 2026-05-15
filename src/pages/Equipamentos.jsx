import { useEffect, useState, useMemo } from 'react'
import { Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'


export function Equipamentos() {
  const { search } = useOutletContext()
  const { invalidate } = useStore()
  const { showToast, confirm } = useToast()
  const audit = useAudit()
  const [list, setList] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editEq, setEditEq] = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [searchLocal, setSearchLocal] = useState('')

  const load = async () => {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .is('deleted_at', null)
      .order('name')
    if (error) {
      showToast(error.message, 'danger')
      return
    }
    setList(data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const categorias = useMemo(
    () =>
      [...new Set((list || []).filter((e) => e.categoria).map((e) => e.categoria))].sort(),
    [list],
  )

  const filtered = useMemo(() => {
    if (!list) return []
    const q = (search || searchLocal).toLowerCase().trim()
    return list.filter((eq) => {
      if (filterCat && (eq.categoria || '') !== filterCat) return false
      if (q) {
        const hay = ((eq.name || '') + ' ' + (eq.categoria || '')).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [list, filterCat, search, searchLocal])

  const onDelete = async (id) => {
    const eq = list.find((e) => e.id === id)
    const ok = await confirm({
      title: 'Excluir equipamento',
      message: `Tem certeza que deseja excluir o equipamento${eq ? ` "${eq.name}"` : ''}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase
      .from('equipment')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) {
      showToast('Erro ao excluir: ' + error.message, 'danger')
      return
    }
    audit.deleted('equipment', id, { name: eq?.name })
    showToast('Equipamento excluído.', 'success')
    invalidate('equipment')
    await load()
  }

  if (!list) return <SkeletonTable />

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Equipamentos</h2>
          <p>Cadastre os equipamentos que poderão ser movimentados.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Cadastrar Equipamento
        </button>
      </div>
      <div className="filter-bar fade-in">
        <div className="filter-row">
          <div className="filter-group" style={{ flex: 2, minWidth: 180 }}>
            <label className="filter-label">Pesquisar</label>
            <input
              type="text"
              className="form-control filter-control"
              placeholder="Nome ou observação..."
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Categoria</label>
            <select
              className="form-control filter-control"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <span className="filter-count">
            {filtered.length} equipamento{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            className="btn-filter-clear"
            onClick={() => {
              setSearchLocal('')
              setFilterCat('')
            }}
          >
            <X size={13} /> Limpar
          </button>
        </div>
      </div>
      <div className="table-card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome do Equipamento</th>
              <th>Categoria</th>
              <th style={{ width: 130 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}
                >
                  Nenhum equipamento encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((eq) => (
                <tr key={eq.id}>
                  <td>
                    <strong>{eq.name}</strong>
                  </td>
                  <td>
                    {eq.categoria ? (
                      <span
                        style={{
                          background: 'rgba(99,102,241,.1)',
                          color: '#6366f1',
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {eq.categoria}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-table-action edit" onClick={() => setEditEq(eq)}>
                        <Pencil size={14} /> Editar
                      </button>
                      <button className="btn-table-action delete" onClick={() => onDelete(eq.id)}>
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
        <EquipModal
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false)
            invalidate('equipment')
            await load()
          }}
        />
      )}
      {editEq && (
        <EquipModal
          eq={editEq}
          onClose={() => setEditEq(null)}
          onSaved={async () => {
            setEditEq(null)
            invalidate('equipment')
            await load()
          }}
        />
      )}
    </>
  )
}

function EquipModal({ eq, onClose, onSaved }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const audit = useAudit()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(eq?.name || '')
  const [categoria, setCategoria] = useState(eq?.categoria || '')
  const editing = !!eq

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const updates = {
      name: name.trim(),
      categoria: categoria.trim() || null,
    }
    if (editing) {
      const { error } = await supabase.from('equipment').update(updates).eq('id', eq.id)
      if (error) {
        showToast('Erro ao atualizar: ' + error.message, 'danger')
        setBusy(false)
        return
      }
      audit.updated('equipment', eq.id, updates)
      showToast('Equipamento atualizado!', 'success')
      onSaved()
    } else {
      const { data: inserted, error } = await supabase
        .from('equipment')
        .insert([{ ...updates, created_by: user.id }])
        .select('id')
        .single()
      if (error) {
        showToast('Erro ao cadastrar: ' + error.message, 'danger')
        setBusy(false)
        return
      }
      audit.created('equipment', inserted?.id, { name: updates.name })
      showToast('Equipamento cadastrado!', 'success')
      onSaved()
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>{editing ? 'Editar Equipamento' : 'Cadastrar Equipamento'}</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>
              Nome do Equipamento <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: Notebook Dell Latitude 5520"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: Computador, Monitor, Switch..."
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              list="equip-cat-list"
            />
            <datalist id="equip-cat-list">
              {['Computador', 'Notebook', 'Monitor', 'Switch', 'Roteador', 'Impressora', 'Projetor', 'Teclado', 'Mouse', 'Servidor', 'No-break', 'Câmera'].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
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
