import { useState } from 'react'
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const DEFAULT_EMAIL_DOMAIN = 'fundepar.pr.gov.br'

const resolveEmail = async (raw) => {
  const trimmed = (raw || '').trim().toLowerCase()
  if (!trimmed) return ''
  if (trimmed.includes('@')) return trimmed
  const { data } = await supabase.rpc('get_email_by_username', { username: trimmed })
  if (data) return data
  return `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`
}

function getPasswordStrength(password) {
  if (!password) return null
  let score = 0
  if (password.length >= 6)           score++
  if (password.length >= 10)          score++
  if (/[A-Z]/.test(password))         score++
  if (/[0-9]/.test(password))         score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 2) return { label: 'Fraca',  color: '#ef4444', width: '33%'  }
  if (score <= 3) return { label: 'Média',  color: '#f59e0b', width: '66%'  }
  return             { label: 'Forte',  color: '#10b981', width: '100%' }
}

export function Login() {
  const { signIn, recoverySession, confirmFirstPassword } = useAuth()

  if (recoverySession) return <SetPasswordForm onConfirm={confirmFirstPassword} />

  return <LoginForm signIn={signIn} />
}

// ── Login normal ──────────────────────────────────────────────────────────────

function LoginForm({ signIn }) {
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const resolvedEmail = await resolveEmail(email)
      await signIn(resolvedEmail, password)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="auth-container" className="auth-container fade-in">
      <div className="auth-card">
        <LogoHeader />
        <h2>Bem-vindo de volta</h2>
        <p className="subtitle">Faça login para acessar a área de gestão.</p>
        <form id="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-email">E-mail ou usuário</label>
            <input
              type="text"
              id="login-email"
              className="form-control"
              required
              autoComplete="username"
              placeholder={`joao  ou  joao@${DEFAULT_EMAIL_DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <small className="form-hint">
              Pode digitar só o usuário — completamos com <strong>@{DEFAULT_EMAIL_DOMAIN}</strong>.
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Senha</label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : 'Entrar no Sistema'}
          </button>
        </form>
        <div className="auth-footer">
          Não possui acesso? Solicite ao administrador do sistema.
        </div>
      </div>
    </div>
  )
}

// ── Definir primeira senha ────────────────────────────────────────────────────

function SetPasswordForm({ onConfirm }) {
  const [newPass, setNewPass]   = useState('')
  const [confPass, setConfPass] = useState('')
  const [busy, setBusy]         = useState(false)
  const [done, setDone]         = useState(false)
  const { showToast } = { showToast: () => {} } // fallback — toast via AuthContext

  const strength       = getPasswordStrength(newPass)
  const passwordsMatch   = confPass.length > 0 && newPass === confPass
  const passwordsMismatch = confPass.length > 0 && newPass !== confPass

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPass !== confPass) return
    if (newPass.length < 6) return
    setBusy(true)
    const error = await onConfirm(newPass)
    if (error) {
      // reusa o toast do contexto indiretamente via AuthContext que já exibe
      setBusy(false)
      return
    }
    setDone(true)
    // USER_UPDATED → fetchProfileInBackground → user setado → redirect automático
  }

  if (done) {
    return (
      <div className="auth-container fade-in">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
          <h2>Senha definida!</h2>
          <p className="subtitle">Entrando no sistema…</p>
          <Loader2 size={20} className="spin" style={{ color: 'var(--accent-color)', marginTop: 8 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container fade-in">
      <div className="auth-card">
        <LogoHeader />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(99,102,241,.08)',
          border: '1px solid rgba(99,102,241,.2)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        }}>
          <KeyRound size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Primeiro acesso
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
              Crie uma senha para acessar o sistema.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nova senha</label>
            <PasswordInput
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              minLength={6}
            />
            {strength && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: strength.width, background: strength.color,
                    borderRadius: 4, transition: 'width .3s ease, background .3s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 4, fontWeight: 600 }}>
                  Força da senha: {strength.label}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Confirmar senha</label>
            <PasswordInput
              value={confPass}
              onChange={(e) => setConfPass(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              borderColor={passwordsMatch ? '#10b981' : passwordsMismatch ? '#ef4444' : undefined}
            />
            {passwordsMatch && (
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>✓ Senhas coincidem</div>
            )}
            {passwordsMismatch && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>✗ Senhas não coincidem</div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !passwordsMatch || newPass.length < 6}
          >
            {busy ? <Loader2 size={16} className="spin" /> : 'Definir Senha e Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function LogoHeader() {
  return (
    <div style={{ textAlign: 'center', margin: '0 auto 16px auto' }}>
      <img
        src="/assets/logo_fundepar.png"
        alt="Fundepar"
        style={{ height: 72, objectFit: 'contain' }}
      />
    </div>
  )
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete, minLength, borderColor }) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-input-wrapper">
      <input
        type={show ? 'text' : 'password'}
        id={id}
        className="form-control"
        required
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        minLength={minLength}
        style={{
          paddingRight: 42,
          ...(borderColor ? { borderColor, boxShadow: `0 0 0 3px ${borderColor}22` } : {}),
        }}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        title={show ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
