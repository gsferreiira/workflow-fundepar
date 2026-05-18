import { useState } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

// Domínio assumido quando o usuário digita só a parte antes do @ (ex: "joao"
// vira "joao@fundepar.pr.gov.br"). Caso a Fundepar mude de domínio, ajustar aqui.
const DEFAULT_EMAIL_DOMAIN = 'fundepar.pr.gov.br'

const normalizeEmail = (raw) => {
  const trimmed = (raw || '').trim().toLowerCase()
  if (!trimmed) return ''
  if (trimmed.includes('@')) return trimmed
  return `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`
}

export function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await signIn(normalizeEmail(email), password)
    } finally {
      setBusy(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await signUp(name, normalizeEmail(email), password)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="auth-container" className="auth-container fade-in">
      {mode === 'login' ? (
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
            Não possui acesso?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setMode('register')
              }}
            >
              Criar Conta
            </a>
          </div>
        </div>
      ) : (
        <div className="auth-card">
          <LogoHeader />
          <h2>Cadastrar Acesso</h2>
          <p className="subtitle">Preencha seus dados para solicitar acesso.</p>
          <form id="register-form" onSubmit={handleSignup}>
            <div className="form-group">
              <label htmlFor="register-name">Nome Completo</label>
              <input
                type="text"
                id="register-name"
                className="form-control"
                required
                placeholder="Ex: Maria Souza"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="register-email">E-mail Corporativo</label>
              <input
                type="text"
                id="register-email"
                className="form-control"
                required
                autoComplete="email"
                placeholder={`nome@${DEFAULT_EMAIL_DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <small className="form-hint">
                Pode digitar só o usuário — completamos com <strong>@{DEFAULT_EMAIL_DOMAIN}</strong>.
              </small>
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Senha Segura</label>
              <PasswordInput
                id="register-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                minLength={6}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={16} className="spin" /> : 'Registrar'}
            </button>
          </form>
          <div className="auth-footer">
            Já possui acesso?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setMode('login')
              }}
            >
              Fazer Login
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function LogoHeader() {
  return (
    <div
      style={{
        background: 'var(--primary-color)',
        color: 'white',
        width: 60,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        fontWeight: 'bold',
        borderRadius: 12,
        margin: '0 auto 16px auto',
      }}
    >
      F
    </div>
  )
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete, minLength }) {
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
        style={{ paddingRight: 42 }}
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
