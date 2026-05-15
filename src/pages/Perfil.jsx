import { useState } from 'react'
import { Loader2, User, Lock, Mail, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonProfile } from '../components/Skeleton.jsx'

const ROLE_LABELS = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuário' }

export function Perfil() {
  const { user, fetchProfile } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.full_name || '')
  const [busyName, setBusyName] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confPass, setConfPass] = useState('')
  const [busyPass, setBusyPass] = useState(false)

  if (!user) return <SkeletonProfile />

  const roleLabel = ROLE_LABELS[user.role] || user.role || 'Usuário'

  const updateName = async (e) => {
    e.preventDefault()
    setBusyName(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', user.id)
    if (error) {
      showToast('Erro ao salvar: ' + error.message, 'danger')
      setBusyName(false)
      return
    }
    await fetchProfile(user)
    setBusyName(false)
    showToast('Nome atualizado!', 'success')
  }

  const updatePassword = async (e) => {
    e.preventDefault()
    if (newPass !== confPass) {
      showToast('As senhas não coincidem.', 'warning')
      return
    }
    setBusyPass(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) {
      showToast('Erro: ' + error.message, 'danger')
      setBusyPass(false)
      return
    }
    setNewPass('')
    setConfPass('')
    setBusyPass(false)
    showToast('Senha alterada com sucesso!', 'success')
  }

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Meu Perfil</h2>
          <p>Atualize seu nome e senha de acesso.</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div className="table-card fade-in" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div
              style={{
                background: 'rgba(99,102,241,.1)',
                color: '#6366f1',
                borderRadius: 12,
                padding: 16,
                flexShrink: 0,
              }}
            >
              <User size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{user.full_name || '—'}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{user.email}</div>
            </div>
          </div>
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mail size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{user.email || '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
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
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="table-card fade-in" style={{ padding: 28 }}>
          <h3 style={{ marginBottom: 20, fontSize: 15, fontWeight: 700 }}>
            <User size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Alterar Nome
          </h3>
          <form onSubmit={updateName}>
            <div className="form-group">
              <label>Nome completo</label>
              <input
                type="text"
                className="form-control"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={busyName}>
                {busyName ? <Loader2 size={14} className="spin" /> : 'Salvar Nome'}
              </button>
            </div>
          </form>
        </div>

        <div className="table-card fade-in" style={{ padding: 28 }}>
          <h3 style={{ marginBottom: 20, fontSize: 15, fontWeight: 700 }}>
            <Lock size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Alterar Senha
          </h3>
          <form onSubmit={updatePassword}>
            <div className="form-group">
              <label>Nova senha</label>
              <input
                type="password"
                className="form-control"
                required
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="form-group">
              <label>Confirmar nova senha</label>
              <input
                type="password"
                className="form-control"
                required
                value={confPass}
                onChange={(e) => setConfPass(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={busyPass}>
                {busyPass ? <Loader2 size={14} className="spin" /> : 'Alterar Senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
