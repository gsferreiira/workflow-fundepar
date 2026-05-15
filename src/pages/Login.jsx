import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

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
    await signIn(email, password)
    setBusy(false)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setBusy(true)
    await signUp(name, email, password)
    setBusy(false)
  }

  return (
    <div id="auth-container" className="auth-container fade-in">
      {mode === 'login' ? (
        <div className="auth-card">
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
          <h2>Bem-vindo de volta</h2>
          <p className="subtitle">Faça login para acessar a área de gestão.</p>
          <form id="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="login-email">E-mail</label>
              <input
                type="email"
                id="login-email"
                className="form-control"
                required
                placeholder="exemplo@fundepar.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Senha</label>
              <input
                type="password"
                id="login-password"
                className="form-control"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                type="email"
                id="register-email"
                className="form-control"
                required
                placeholder="nome@fundepar.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Senha Segura</label>
              <input
                type="password"
                id="register-password"
                className="form-control"
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
