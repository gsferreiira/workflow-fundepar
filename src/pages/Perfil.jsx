import { useEffect, useState } from 'react'
import { Loader2, Lock, Mail, Shield, Eye, EyeOff, UserRound, Calendar, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { SkeletonProfile } from '../components/Skeleton.jsx'
import { fmtDate, fmtDateTime } from '../utils/format.js'

function PasswordInput({ value, onChange, placeholder, minLength, autoComplete = 'new-password', borderColor }) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-input-wrapper">
      <input
        type={show ? 'text' : 'password'}
        className="form-control"
        required
        minLength={minLength}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{ paddingRight: 42, ...(borderColor ? { borderColor, boxShadow: `0 0 0 3px ${borderColor}22` } : {}) }}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  let score = 0
  if (password.length >= 6)            score++
  if (password.length >= 10)           score++
  if (/[A-Z]/.test(password))          score++
  if (/[0-9]/.test(password))          score++
  if (/[^A-Za-z0-9]/.test(password))  score++

  const levels = [
    { label: 'Fraca',  color: '#ef4444', width: '33%'  },
    { label: 'Média',  color: '#f59e0b', width: '66%'  },
    { label: 'Forte',  color: '#10b981', width: '100%' },
  ]
  const level = score <= 2 ? levels[0] : score <= 3 ? levels[1] : levels[2]

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: level.width,
            background: level.color,
            borderRadius: 4,
            transition: 'width .3s ease, background .3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: level.color, marginTop: 4, fontWeight: 600 }}>
        Força da senha: {level.label}
      </div>
    </div>
  )
}

const ROLE_LABELS = {
  admin:       'Administrador',
  tecnico:     'Técnico',
  usuario:     'Usuário',
  coordenador: 'Coordenador',
  patrimonio:  'Patrimônio',
}

const ROLE_COLORS = {
  admin:       { bg: 'rgba(239,68,68,.12)',  color: '#dc2626' },
  tecnico:     { bg: 'rgba(99,102,241,.12)', color: '#6366f1' },
  usuario:     { bg: 'rgba(14,165,233,.12)', color: '#0ea5e9' },
  coordenador: { bg: 'rgba(5,150,105,.12)',  color: '#059669' },
  patrimonio:  { bg: 'rgba(245,158,11,.12)', color: '#d97706' },
}

function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Perfil() {
  const { user, fetchProfile } = useAuth()
  const { showToast } = useToast()
  const [name, setName]         = useState(user?.full_name || '')
  const [busyName, setBusyName] = useState(false)
  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [busyPass, setBusyPass] = useState(false)

  useEffect(() => { setName(user?.full_name || '') }, [user?.full_name])

  if (!user) return <SkeletonProfile />

  const roleLabel = ROLE_LABELS[user.role] || user.role || 'Usuário'
  const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.usuario
  const initials  = getInitials(user.full_name)
  const nameUnchanged = name.trim() === (user.full_name || '')

  const passwordsMatch   = confPass.length > 0 && newPass === confPass
  const passwordsMismatch = confPass.length > 0 && newPass !== confPass
  const confirmBorderColor = passwordsMatch ? '#10b981' : passwordsMismatch ? '#ef4444' : undefined

  const updateName = async (e) => {
    e.preventDefault()
    setBusyName(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
    if (error) { showToast('Erro ao salvar: ' + error.message, 'danger'); setBusyName(false); return }
    await fetchProfile(user)
    setBusyName(false)
    showToast('Nome atualizado!', 'success')
  }

  const updatePassword = async (e) => {
    e.preventDefault()
    if (newPass !== confPass) { showToast('As senhas não coincidem.', 'warning'); return }
    setBusyPass(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) { showToast('Erro: ' + error.message, 'danger'); setBusyPass(false); return }
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

        {/* ── Hero card ── */}
        <div className="table-card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            height: 80,
            background: 'linear-gradient(135deg, rgba(99,102,241,.18) 0%, rgba(14,165,233,.14) 100%)',
            borderBottom: '1px solid var(--border-color)',
          }} />

          <div style={{ padding: '0 28px 24px' }}>
            <div
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: 1,
                border: '3px solid var(--bg-card)',
                marginTop: -36, marginBottom: 14, flexShrink: 0,
                boxShadow: '0 4px 14px rgba(99,102,241,.35)',
              }}
            >
              {initials}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{user.full_name || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Mail size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.email}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                <Shield size={13} style={{ color: roleStyle.color }} />
                <span style={{
                  background: roleStyle.bg, color: roleStyle.color,
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                }}>
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              borderTop: '1px solid var(--border-color)',
              marginTop: 18, paddingTop: 16,
              display: 'flex', gap: 28, flexWrap: 'wrap',
            }}>
              {user.created_at && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Calendar size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Membro desde{' '}
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {fmtDate(user.created_at)}
                    </strong>
                  </span>
                </div>
              )}
              {user.last_seen_at && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Clock size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Último acesso{' '}
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {fmtDateTime(user.last_seen_at)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Forms row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}>

          {/* Alterar Nome */}
          <div className="table-card fade-in" style={{ padding: 28, borderTop: '3px solid #0ea5e9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(14,165,233,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <UserRound size={16} style={{ color: '#0ea5e9' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Alterar Nome</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Nome exibido no sistema</div>
              </div>
            </div>
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
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busyName || nameUnchanged}
                  title={nameUnchanged ? 'Nenhuma alteração para salvar' : undefined}
                >
                  {busyName ? <Loader2 size={14} className="spin" /> : 'Salvar Nome'}
                </button>
              </div>
            </form>
          </div>

          {/* Alterar Senha */}
          <div className="table-card fade-in" style={{ padding: 28, borderTop: '3px solid #6366f1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(99,102,241,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Lock size={16} style={{ color: '#6366f1' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Alterar Senha</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Mínimo 6 caracteres</div>
              </div>
            </div>
            <form onSubmit={updatePassword}>
              <div className="form-group">
                <label>Nova senha</label>
                <PasswordInput
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
                <PasswordStrength password={newPass} />
              </div>
              <div className="form-group">
                <label>Confirmar nova senha</label>
                <PasswordInput
                  value={confPass}
                  onChange={(e) => setConfPass(e.target.value)}
                  placeholder="Repita a nova senha"
                  borderColor={confirmBorderColor}
                />
                {passwordsMatch && (
                  <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                    ✓ Senhas coincidem
                  </div>
                )}
                {passwordsMismatch && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
                    ✗ Senhas não coincidem
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="submit" className="btn-primary" disabled={busyPass}>
                  {busyPass ? <Loader2 size={14} className="spin" /> : 'Alterar Senha'}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </>
  )
}
