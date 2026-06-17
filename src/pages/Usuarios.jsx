import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Plus, X, Loader2, Pencil, Trash2, KeyRound,
  Clock, Mail, Shield, CheckCircle, AlertCircle,
  User, RefreshCw, Send,
} from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAudit } from '../hooks/useAudit.js'
import { SkeletonTable } from '../components/Skeleton.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { fmtDate, fmtDateTime } from '../utils/format.js'

const DEFAULT_EMAIL_DOMAIN = 'fundepar.pr.gov.br'

const normalizeEmail = (raw) => {
  const trimmed = (raw || '').trim().toLowerCase()
  if (!trimmed) return ''
  if (trimmed.includes('@')) return trimmed
  return `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`
}

const ROLES = [
  { value: 'usuario', label: 'Usuário' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'patrimonio', label: 'Patrimônio' },
  { value: 'admin', label: 'Administrador' },
]
const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label || r || '—'

// ── Status de conta ──────────────────────────────────────────────────────────
function getUserStatus(authInfo, profile) {
  if (!authInfo) return null
  if (!authInfo.confirmed_at) return 'pending'
  if (!profile?.last_seen_at) return 'never'
  const days = (Date.now() - new Date(profile.last_seen_at)) / 86_400_000
  return days <= 30 ? 'active' : 'inactive'
}

const STATUS_CFG = {
  pending:  { label: 'Convite Pendente', color: '#d97706', bg: 'rgba(245,158,11,.12)',   icon: AlertCircle },
  active:   { label: 'Ativo',            color: '#059669', bg: 'rgba(16,185,129,.12)',   icon: CheckCircle },
  inactive: { label: 'Inativo',          color: '#64748b', bg: 'rgba(100,116,139,.12)', icon: Clock },
  never:    { label: 'Nunca acessou',    color: '#2563eb', bg: 'rgba(59,130,246,.12)',   icon: User },
}

function StatusBadge({ status, small = false }) {
  if (!status) return <span style={{ color: 'var(--text-secondary)' }}>—</span>
  const cfg = STATUS_CFG[status] || {}
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, color: cfg.color,
      padding: small ? '1px 7px' : '2px 9px',
      borderRadius: 20, fontSize: small ? 11 : 12, fontWeight: 600,
    }}>
      {Icon && <Icon size={small ? 10 : 12} />}
      {cfg.label}
    </span>
  )
}

// ── Busca dados de auth (requer a função SQL no Supabase) ─────────────────────
async function fetchAuthInfo() {
  const { data, error } = await supabase.rpc('get_users_auth_info')
  if (error) {
    // Função não criada ainda — silencioso, UI degrada graciosamente
    if (!error.message.includes('does not exist')) {
      console.warn('get_users_auth_info:', error.message)
    }
    return {}
  }
  return Object.fromEntries((data || []).map((r) => [r.id, r]))
}

// ── Componente principal ──────────────────────────────────────────────────────
export function Usuarios() {
  const { search, registerRefresh } = useOutletContext()
  const { user, adminCreateUser } = useAuth()
  const { invalidate } = useStore()
  const { showToast, showUndoToast, confirm } = useToast()
  const audit = useAudit()
  const [list, setList] = useState(null)
  const [authMap, setAuthMap] = useState({})
  const [authLoading, setAuthLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [detailUser, setDetailUser] = useState(null)
  const isAdmin = user?.role === 'admin'
  const loadRef = useRef(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('full_name')
    if (error) { showToast(error.message, 'danger'); return }
    setList(data || [])
  }
  loadRef.current = load

  useEffect(() => {
    load()
    registerRefresh?.(() => loadRef.current?.())
    return () => registerRefresh?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carrega info de auth separado (só admin, pode falhar se SQL não foi criado)
  useEffect(() => {
    if (!isAdmin) { setAuthLoading(false); return }
    fetchAuthInfo().then((map) => { setAuthMap(map); setAuthLoading(false) })
  }, [isAdmin])

  const refreshAuthInfo = async () => {
    setAuthLoading(true)
    const map = await fetchAuthInfo()
    setAuthMap(map)
    setAuthLoading(false)
  }

  const filtered = useMemo(() => {
    if (!list) return []
    const q = (search || '').toLowerCase().trim()
    if (!q) return list
    return list.filter((u) =>
      [u.full_name, u.email, roleLabel(u.role)]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [list, search])

  const updateRole = async (userId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) { showToast('Erro ao atualizar permissão.', 'danger'); return }
    audit.updated('profiles', userId, { role })
    showToast('Permissão atualizada!', 'success')
    setList((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    invalidate('profiles')
  }

  const resetSenha = async (u, isResendInvite = false) => {
    const ok = await confirm({
      title: isResendInvite ? 'Reenviar convite' : 'Enviar e-mail de redefinição',
      message: isResendInvite
        ? `Será reenviado um e-mail de convite para "${u.full_name || u.email}" definir sua senha. Deseja continuar?`
        : `Será enviado um e-mail para "${u.full_name || u.email}" com um link para redefinir a senha. Deseja continuar?`,
      confirmText: isResendInvite ? 'Reenviar convite' : 'Enviar e-mail',
    })
    if (!ok) return
    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo })
    if (error) { showToast('Erro ao enviar e-mail: ' + error.message, 'danger'); return }
    audit.log('password_reset', 'profiles', u.id, { email: u.email, resend_invite: isResendInvite })
    showToast(
      isResendInvite
        ? `Convite reenviado para "${u.full_name || u.email}".`
        : `E-mail de redefinição enviado para "${u.full_name || u.email}".`,
      'success',
    )
  }

  const deleteUsuario = async (userId) => {
    const u = list.find((x) => x.id === userId)
    const ok = await confirm({
      title: 'Excluir usuário',
      message: `Tem certeza que deseja excluir${u ? ` "${u.full_name || u.email}"` : ' este usuário'}?`,
      confirmText: 'Excluir',
      danger: true,
    })
    if (!ok) return
    const { data: deleted, error } = await supabase
      .from('profiles').update({ deleted_at: new Date().toISOString() })
      .eq('id', userId).is('deleted_at', null).select()
    if (error || !deleted || deleted.length === 0) {
      showToast(error ? 'Erro: ' + error.message : 'Sem permissão. Verifique as políticas RLS no Supabase.', 'danger')
      return
    }
    audit.deleted('profiles', userId, { full_name: u?.full_name, email: u?.email })
    invalidate('profiles')
    await load()
    showUndoToast(`Usuário "${u?.full_name || u?.email || 'sem nome'}" removido.`, async () => {
      await supabase.from('profiles').update({ deleted_at: null }).eq('id', userId)
      invalidate('profiles')
      await load()
    })
  }

  // Contadores para o resumo
  const counts = useMemo(() => {
    if (!list) return null
    const total = list.length
    const pending = list.filter((u) => getUserStatus(authMap[u.id], u) === 'pending').length
    const active = list.filter((u) => getUserStatus(authMap[u.id], u) === 'active').length
    const inactive = list.filter((u) => getUserStatus(authMap[u.id], u) === 'inactive').length
    const never = list.filter((u) => getUserStatus(authMap[u.id], u) === 'never').length
    return { total, pending, active, inactive, never }
  }, [list, authMap])

  if (!list) return <SkeletonTable />

  const colSpan = isAdmin ? 6 : 4

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

      {/* ── Painel de resumo ── */}
      {isAdmin && counts && (
        <div
          className="fade-in"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {[
            { label: 'Total',            value: counts.total,    color: '#6366f1', bg: 'rgba(99,102,241,.08)' },
            { label: 'Ativos',           value: counts.active,   color: '#059669', bg: 'rgba(16,185,129,.08)' },
            { label: 'Inativos',         value: counts.inactive, color: '#64748b', bg: 'rgba(100,116,139,.08)' },
            { label: 'Nunca acessaram',  value: counts.never,    color: '#2563eb', bg: 'rgba(59,130,246,.08)' },
            { label: 'Convite Pendente', value: counts.pending,  color: '#d97706', bg: 'rgba(245,158,11,.08)' },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                background: c.bg,
                borderRadius: 10,
                padding: '12px 16px',
                borderLeft: `3px solid ${c.color}`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="table-card fade-in">
        {isAdmin && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '8px 16px 0', gap: 8,
          }}>
            {authLoading && <Loader2 size={13} className="spin" style={{ color: 'var(--text-secondary)' }} />}
            {!authLoading && Object.keys(authMap).length === 0 && (
              <span style={{ fontSize: 12, color: '#d97706' }}>
                ⚠ Função SQL não criada — status de acesso indisponível
              </span>
            )}
            <button
              className="btn-filter-clear"
              onClick={async () => { await load(); await refreshAuthInfo() }}
              title="Recarregar dados"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Nível de Acesso</th>
              {isAdmin && <th>Status da Conta</th>}
              {isAdmin && <th>Último Acesso</th>}
              {isAdmin && <th style={{ width: 160 }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState
                    preset={search ? 'search' : 'users'}
                    title={search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                    description={search ? 'Tente outro termo de busca.' : 'Adicione um usuário para começar.'}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const auth = authMap[u.id]
                const status = getUserStatus(auth, u)
                const isPending = status === 'pending'
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Avatar initials */}
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(99,102,241,.12)',
                          color: '#6366f1', fontWeight: 700, fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {(u.full_name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong>{u.full_name || '—'}</strong>
                            {u.id === user?.id && (
                              <span style={{
                                background: 'rgba(99,102,241,.1)', color: '#6366f1',
                                padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                              }}>Você</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                            desde {fmtDate(u.created_at)}
                          </div>
                        </div>
                      </div>
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
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{
                          background: 'rgba(99,102,241,.1)', color: '#6366f1',
                          padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        }}>
                          {roleLabel(u.role)}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        {authLoading ? (
                          <Loader2 size={12} className="spin" style={{ color: 'var(--text-secondary)' }} />
                        ) : (
                          <StatusBadge status={status} small />
                        )}
                      </td>
                    )}
                    {isAdmin && (
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {u.last_seen_at
                          ? fmtDateTime(u.last_seen_at)
                          : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</span>
                        }
                      </td>
                    )}
                    {isAdmin && (
                      <td>
                        {u.id !== user?.id && (
                          <div className="table-actions">
                            <button
                              className="btn-table-action edit"
                              onClick={() => setDetailUser({ profile: u, auth })}
                              title="Ver detalhes"
                            >
                              <User size={14} />
                            </button>
                            <button
                              className="btn-table-action edit"
                              onClick={() => setEditUser(u)}
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            {isPending ? (
                              <button
                                className="btn-table-action"
                                onClick={() => resetSenha(u, true)}
                                title="Reenviar convite"
                                style={{ color: '#d97706' }}
                              >
                                <Send size={14} />
                              </button>
                            ) : (
                              <button
                                className="btn-table-action"
                                onClick={() => resetSenha(u, false)}
                                title="Redefinir senha"
                                style={{ color: 'var(--warning-color)' }}
                              >
                                <KeyRound size={14} />
                              </button>
                            )}
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
                )
              })
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
            await refreshAuthInfo()
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
      {detailUser && (
        <UserDetailModal
          profile={detailUser.profile}
          auth={detailUser.auth}
          currentUserId={user?.id}
          onClose={() => setDetailUser(null)}
          onEdit={() => { setDetailUser(null); setEditUser(detailUser.profile) }}
          onResetSenha={() => resetSenha(detailUser.profile, getUserStatus(detailUser.auth, detailUser.profile) === 'pending')}
          onDelete={() => { setDetailUser(null); deleteUsuario(detailUser.profile.id) }}
        />
      )}
    </>
  )
}

// ── Modal de detalhes do usuário ──────────────────────────────────────────────
function UserDetailModal({ profile, auth, currentUserId, onClose, onEdit, onResetSenha, onDelete }) {
  const status = getUserStatus(auth, profile)
  const cfg = STATUS_CFG[status]
  const isPending = status === 'pending'
  const initials = (profile.full_name || profile.email || '?')[0].toUpperCase()

  const InfoRow = ({ icon: Icon, label, value, valueStyle }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
      <Icon size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, ...valueStyle }}>{value}</span>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>Detalhes do Usuário</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Avatar + nome + status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '16px', background: 'var(--bg-main)', borderRadius: 12, marginBottom: 20,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: cfg ? cfg.bg : 'rgba(99,102,241,.12)',
            color: cfg ? cfg.color : '#6366f1',
            fontWeight: 800, fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {profile.full_name || '—'}
              {profile.id === currentUserId && (
                <span style={{
                  marginLeft: 8, background: 'rgba(99,102,241,.1)', color: '#6366f1',
                  padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                }}>Você</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{profile.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(99,102,241,.1)', color: '#6366f1',
                padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              }}>
                {roleLabel(profile.role)}
              </span>
              <StatusBadge status={status} small />
            </div>
          </div>
        </div>

        {/* Informações da conta */}
        <p style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4 }}>
          Informações da conta
        </p>
        <div style={{ marginBottom: 20 }}>
          <InfoRow icon={User}         label="Cadastrado em"     value={fmtDateTime(profile.created_at) || '—'} />
          <InfoRow icon={Mail}         label="E-mail"            value={profile.email || '—'} />
          <InfoRow icon={Shield}       label="Nível de acesso"   value={roleLabel(profile.role)} />
        </div>

        {/* Informações de acesso */}
        <p style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4 }}>
          Acesso ao sistema
        </p>
        {!auth ? (
          <div style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: 13, fontStyle: 'italic' }}>
            Dados de acesso indisponíveis — crie a função SQL no Supabase.
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <InfoRow
              icon={CheckCircle}
              label="E-mail confirmado"
              value={auth.confirmed_at ? `Sim — ${fmtDateTime(auth.confirmed_at)}` : 'Não confirmado'}
              valueStyle={{ color: auth.confirmed_at ? '#059669' : '#d97706' }}
            />
            <InfoRow
              icon={Clock}
              label="Último acesso"
              value={profile.last_seen_at ? fmtDateTime(profile.last_seen_at) : '—'}
            />
            {auth.invited_at && (
              <InfoRow
                icon={Send}
                label="Convite enviado em"
                value={fmtDateTime(auth.invited_at)}
              />
            )}
          </div>
        )}

        {/* Alerta convite pendente */}
        {isPending && (
          <div style={{
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)',
            borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start',
            marginBottom: 20,
          }}>
            <AlertCircle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Este usuário ainda não ativou a conta. O e-mail de convite pode ter expirado ou não chegado — clique em <strong>Reenviar convite</strong> para reenviar.
            </span>
          </div>
        )}

        {/* Ações */}
        {profile.id !== currentUserId && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#e2e8f0', color: '#475569' }}
              onClick={onClose}
            >
              Fechar
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#e2e8f0', color: '#475569' }}
              onClick={onEdit}
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: isPending ? '#d97706' : 'rgba(245,158,11,.1)', color: isPending ? '#fff' : '#d97706' }}
              onClick={onResetSenha}
            >
              {isPending ? <Send size={13} /> : <KeyRound size={13} />}
              {isPending ? 'Reenviar convite' : 'Redefinir senha'}
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626' }}
              onClick={onDelete}
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        )}
        {profile.id === currentUserId && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal de criação ──────────────────────────────────────────────────────────
function UsuarioCreateModal({ adminCreateUser, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('usuario')

  const finalEmail = normalizeEmail(email)

  const submit = async (e) => {
    e.preventDefault()
    if (!finalEmail) { showToast('Informe o e-mail ou usuário.', 'warning'); return }
    setBusy(true)
    const newUser = await adminCreateUser(fullName.trim(), finalEmail, role)
    if (!newUser) { setBusy(false); return }
    audit.created('profiles', newUser.id, { full_name: fullName.trim(), email: finalEmail, role })
    showToast(
      `Usuário "${fullName}" criado. Um e-mail de definição de senha foi enviado para ${finalEmail}.`,
      'success',
    )
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>Novo Usuário</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nome completo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input type="text" className="form-control" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Maria Souza" />
          </div>
          <div className="form-group">
            <label>E-mail ou usuário <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input type="text" className="form-control" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`maria  ou  maria@${DEFAULT_EMAIL_DOMAIN}`} />
            {email && !email.includes('@') && (
              <small className="form-hint">Será usado: <strong>{finalEmail}</strong></small>
            )}
          </div>
          <div className="form-group">
            <label>Nível de Acesso</label>
            <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Um e-mail será enviado para o usuário definir sua senha.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de edição ───────────────────────────────────────────────────────────
function UsuarioEditModal({ usuario, audit, onClose, onSaved }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [fullName, setFullName] = useState(usuario.full_name || '')
  const [email, setEmail] = useState(usuario.email || '')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { data: existing, error: checkError } = await supabase
      .from('profiles').select('id').eq('email', email.trim()).neq('id', usuario.id).is('deleted_at', null).limit(1)
    if (checkError) { showToast('Erro ao validar e-mail: ' + checkError.message, 'danger'); setBusy(false); return }
    if (existing && existing.length > 0) { showToast('Este e-mail já está em uso por outro usuário.', 'warning'); setBusy(false); return }
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), email: email.trim() }).eq('id', usuario.id)
    if (error) { showToast('Erro ao atualizar: ' + error.message, 'danger'); setBusy(false); return }
    audit.updated('profiles', usuario.id, { full_name: fullName.trim(), email: email.trim() })
    showToast('Usuário atualizado!', 'success')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Editar Usuário</h3>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nome completo <span style={{ color: 'var(--danger-color)' }}>*</span></label>
            <input type="text" className="form-control" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>E-mail de exibição</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn-primary" style={{ background: '#e2e8f0', color: '#475569' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
