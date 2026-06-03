import { useParams } from 'react-router-dom'

export function ConferenciasSetor() {
  const { sigla } = useParams()

  return (
    <div>
      <div className="view-header">
        <div>
          <h2>Conferências — {sigla?.toUpperCase()}</h2>
          <p>Histórico e conferências pendentes do setor.</p>
        </div>
      </div>
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Fluxo de conferência será implementado em breve.
      </div>
    </div>
  )
}
