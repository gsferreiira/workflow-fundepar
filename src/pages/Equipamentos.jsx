import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { DOMINIOS, CATEGORIAS_POR_DOMINIO, ROLES_FULL_ACCESS } from '../config/dominios.js'


export function Equipamentos() {
  const { search, registerRefresh } = useOutletContext()
  const { invalidate } = useStore()
  const { showToast, showUndoToast, confirm } = useToast()
  const audit = useAudit()
  const [list, setList] = useState(null)
  const { user } = useAuth()
  const canSeeAll = ROLES_FULL_ACCESS.includes(user?.role)
  const [createOpen, setCreateOpen] = useState(false)
  const [editEq, setEditEq] = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [filterDominio, setFilterDominio] = useState('')
  const [searchLocal, setSearchLocal] = useState('')
  const loadRef = useRef(null)

  const load = async () => {
    let q = supabase.from('equipment').select('*').is('deleted_at', null).order('name')
    if (!canSeeAll) q = q.eq('dominio', 'TI')
    const { data, error } = await q
    if (error) {
      showToast(error.message, 'danger')
      return
    }
    setList(data || [])
  }
  loadRef.current = load
  useEffect(() => {
    load()
    registerRefresh?.(() => loadRef.current?.())
    return () => registerRefresh?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (filterDominio && (eq.dominio || 'TI') !== filterDominio) return false
      if (filterCat && (eq.categoria || '') !== filterCat) return false
      if (q) {
        const hay = ((eq.name || '') + ' ' + (eq.categoria || '') + ' ' + (eq.dominio || '')).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [list, filterDominio, filterCat, search, searchLocal])

  const onDelete = async (id) => {
    const eq = list.find((e) => e.id === id)
    const ok = await confirm({
      title: 'Excluir equipamento',
      message: `Tem certeza que deseja excluir o equipamento${eq ? ` "${eq.name}"` : ''}?`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase
      .from('equipment')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) { showToast('Erro ao excluir: ' + error.message, 'danger'); return }
    audit.deleted('equipment', id, { name: eq?.name })
    invalidate('equipment')
    await load()
    showUndoToast(`Equipamento "${eq?.name || 'sem nome'}" excluído.`, async () => {
      await supabase.from('equipment').update({ deleted_at: null }).eq('id', id)
      invalidate('equipment')
      await load()
    })
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
              placeholder="Nome ou categoria..."
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
            />
          </div>
          {canSeeAll && (
            <div className="filter-group">
              <label className="filter-label">Classificação</label>
              <select
                className="form-control filter-control"
                value={filterDominio}
                onChange={(e) => { setFilterDominio(e.target.value); setFilterCat('') }}
              >
                <option value="">Todos</option>
                {DOMINIOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label className="filter-label">Categoria</label>
            <select
              className="form-control filter-control"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
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
            onClick={() => { setSearchLocal(''); setFilterCat(''); setFilterDominio('') }}
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
              {canSeeAll && <th style={{ width: 130 }}>Classificação</th>}
              <th>Categoria</th>
              <th style={{ width: 130 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canSeeAll ? 4 : 3}>
                  <EmptyState
                    preset={search || filterCat || filterDominio ? 'search' : 'package'}
                    title={search || filterCat || filterDominio ? 'Nenhum equipamento encontrado' : 'Nenhum equipamento cadastrado'}
                    description={search || filterCat || filterDominio ? 'Tente ajustar o filtro ou a busca.' : 'Clique em "Cadastrar Equipamento" para cadastrar.'}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((eq) => (
                <tr key={eq.id}>
                  <td>
                    <strong>{eq.name}</strong>
                  </td>
                  {canSeeAll && (
                    <td>
                      <span style={{
                        background: (eq.dominio || 'TI') === 'TI' ? 'rgba(99,102,241,.1)' : 'rgba(16,185,129,.1)',
                        color: (eq.dominio || 'TI') === 'TI' ? '#6366f1' : '#059669',
                        padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      }}>
                        {eq.dominio || 'TI'}
                      </span>
                    </td>
                  )}
                  <td>
                    {eq.categoria ? (
                      <span style={{ background: 'rgba(99,102,241,.1)', color: '#6366f1', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
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
  const canSeeAll = ROLES_FULL_ACCESS.includes(user?.role)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(eq?.name || '')
  const [dominio, setDominio] = useState(eq?.dominio || 'TI')
  const [categoria, setCategoria] = useState(eq?.categoria || '')
  const editing = !!eq

  const catOptions = CATEGORIAS_POR_DOMINIO[dominio] || []

  const handleDominioChange = (v) => {
    setDominio(v)
    setCategoria('') // reset categoria ao mudar domínio
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const updates = {
      name: name.trim(),
      dominio: canSeeAll ? dominio : 'TI',
      categoria: categoria.trim() || null,
    }
    if (editing) {
      const { error } = await supabase.from('equipment').update(updates).eq('id', eq.id)
      if (error) { showToast('Erro ao atualizar: ' + error.message, 'danger'); setBusy(false); return }
      audit.updated('equipment', eq.id, { previous: { name: eq.name, categoria: eq.categoria, dominio: eq.dominio }, next: updates })
      showToast('Equipamento atualizado!', 'success')
      onSaved()
    } else {
      const { data: inserted, error } = await supabase
        .from('equipment')
        .insert([{ ...updates, created_by: user.id }])
        .select('id')
        .single()
      if (error) { showToast('Erro ao cadastrar: ' + error.message, 'danger'); setBusy(false); return }
      audit.created('equipment', inserted?.id, { name: updates.name, dominio: updates.dominio })
      showToast('Equipamento cadastrado!', 'success')
      onSaved()
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>{editing ? 'Editar Equipamento' : 'Cadastrar Equipamento'}</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nome do Equipamento <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: Notebook Dell Latitude 5520"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {canSeeAll && (
            <div className="form-group">
              <label>Classificação <span style={{ color: 'var(--danger-color)' }}>*</span></label>
              <select className="form-control" value={dominio} onChange={(e) => handleDominioChange(e.target.value)}>
                {DOMINIOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Categoria</label>
            <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Selecione...</option>
              {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
