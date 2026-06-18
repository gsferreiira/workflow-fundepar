import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    const { fallback, children } = this.props

    if (!error) return children

    if (fallback) return fallback(error, () => this.setState({ error: null }))

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 320,
          padding: 40,
          textAlign: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>⚠️</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            Algo deu errado
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 420 }}>
            {error?.message || 'Ocorreu um erro inesperado nesta tela.'}
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={() => this.setState({ error: null })}
          style={{ marginTop: 4 }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }
}
