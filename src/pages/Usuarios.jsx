import { useEffect, useState, useMemo } from 'react'
import { Plus, X, Loader2, Pencil, Trash2, KeyRound } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { fmtDate } from '../utils/format.js'

const ROLES = [
  { value: 'usuario', label: 'Usuário' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'admin', label: 'Administrador' },
]
const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label || r || '—'

export function Usuarios() {
  const { search } = useOutletContext()
  const { user, adminCreateUser } = useAuth()
  const { invalidate } = useStore()
  const { showToast, confirm } = useToast()
  const audit = useAudit()
  const [list, setList] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const isAdmin = user?.role === 'admin'

  const load = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('full_name')
    if (error) {
      showToast(error.message, 'danger')
      return
    }
    setList(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!list) return []
    const q = (search || '').toLowerCase().trim()
    if (!q) return list
    return list.filter((u) =>
      [u.full_name, u.email, roleLabel(u.role)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [list, search])

  const updateRole = async (userId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) {
      showToast('Erro ao atualizar permissão.', 'danger')
      return
    }
    audit.updated('profiles', userId, { role })
    showToast('Permissão atualizada!', 'success')
    setList((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    invalidate('profiles')
  }

  const resetSenha = async (u) => {
    const ok = await confirm({
      title: 'Enviar e-mail de redefinição',
      message: `Será enviado um e-mail para "${u.full_name || u.email}" com um link para redefinir a senha. Deseja continuar?`,
      confirmText: 'Enviar e-mail',
    })
    if (!ok) return
    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo })
    if (error) {
      showToast('Erro ao enviar e-mail: ' + error.message, 'danger')
      return
    }
    audit.log('password_reset', 'profiles', u.id, { email: u.email })
    showToast(`E-mail de redefinição enviado para "${u.full_name || u.email}".`, 'success')
  }

  const deleteUsuario = async (userId) => {
    const u = list.find((x) => x.id === userId)
    const ok = await confirm({
      title: 'Excluir usuário',
      message: `Tem certeza que deseja excluir${u ? ` "${u.full_name || u.email}"` : ' este usuário'}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { data: deleted, error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId)
      .is('deleted_at', null)
      .select()
    if (error || !deleted || deleted.length === 0) {
      showToast(
        error ? 'Erro: ' + error.message : 'Sem permissão. Verifique as políticas RLS no Supabase.',
        'danger',
      )
      return
    }
    audit.deleted('profiles', userId, { full_name: u?.full_name, email: u?.email })
    showToast('Usuário removido.', 'success')
    invalidate('profiles')
    await load()
  }

  if (!list) return <SkeletonTable />

  const colSpan = isAdmin ? 5 : 4

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Usuários</h2>
          <p>Gerencie as contas e permissões de acesso ao sistema.</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Novo Usuário
          </button>
        )}
      </div>

      <div className="table-card fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Nível de Acesso</th>
              <th>Cadastrado em</th>
              {isAdmin && <th style={{ width: 160 }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}
                >
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.full_name || '—'}</strong>
                    {u.id === user?.id && (
                      <span
                        style={{
                          marginLeft: 8,
                          background: 'rgba(99,102,241,.1)',
                          color: '#6366f1',
                          padding: '1px 7px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Você
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                  <td>
                    {isAdmin && u.id !== user?.id ? (
                      <select
                        className="form-control filter-control"
                        style={{ maxWidth: 160 }}
                        value={u.role || 'usuario'}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
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
                        {roleLabel(u.role)}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(u.created_at)}</td>
                  {isAdmin && (
                    <td>
                      {u.id !== user?.id && (
                        <div className="table-actions">
                          <button
                            className="btn-table-action edit"
                            onClick={() => setEditUser(u)}
                          >
                            <Pencil size={14} /> Editar
                          </button>
                          <button
                            className="btn-table-action"
                            onClick={() => resetSenha(u)}
                            title="Redefinir senha"
                            style={{ color: 'var(--warning-color)' }}
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            className="btn-table-action delete"
                            onClick={() => deleteUsuario(u.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <UsuarioCreateModal
          adminCreateUser={adminCreateUser}
          audit={audit}
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false)
            invalidate('profiles')
            await load()
          }}
        />
      )}
      {editUser && (
        <UsuarioEditModal
          usuario={editUser}
          audit={audit}
          onClose={() => setEditUser(null)}
          onSaved={async () => {
            setEditUser(null)
            invalidate('profiles')
            await load()
          }}
        />
      )}
    </>
  )
}

function UsuarioCreateModal({ adminCreateUser, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('usuario')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const newUser = await adminCreateUser(fullName.trim(), email.trim(), role)
    if (!newUser) {
      setBusy(false)
      return
    }
    audit.created('profiles', newUser.id, {
      full_name: fullName.trim(),
      email: email.trim(),
      role,
    })
    showToast(
      `Usuário "${fullName}" criado. Um e-mail de definição de senha foi enviado.`,
      'success',
    )
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>Novo Usuário</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>
              Nome completo <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Maria Souza"
            />
          </div>
          <div className="form-group">
            <label>
              E-mail <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              type="email"
              className="form-control"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
            />
          </div>
          <div className="form-group">
            <label>Nível de Acesso</label>
            <select
              className="form-control"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Um e-mail será enviado para o usuário definir sua senha.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#e2e8f0', color: '#475569' }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UsuarioEditModal({ usuario, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [fullName, setFullName] = useState(usuario.full_name || '')
  const [email, setEmail] = useState(usuario.email || '')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { data: existing, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .neq('id', usuario.id)
      .is('deleted_at', null)
      .limit(1)
    if (checkError) {
      showToast('Erro ao validar e-mail: ' + checkError.message, 'danger')
      setBusy(false)
      return
    }
    if (existing && existing.length > 0) {
      showToast('Este e-mail já está em uso por outro usuário.', 'warning')
      setBusy(false)
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), email: email.trim() })
      .eq('id', usuario.id)
    if (error) {
      showToast('Erro ao atualizar: ' + error.message, 'danger')
      setBusy(false)
      return
    }
    audit.updated('profiles', usuario.id, { full_name: fullName.trim(), email: email.trim() })
    showToast('Usuário atualizado!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Editar Usuário</h3>
          <button className="modal-close" type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>
              Nome completo <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>E-mail de exibição</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#e2e8f0', color: '#475569' }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
