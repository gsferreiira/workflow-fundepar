import { useState } from 'react'
import {
  ArrowRightLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  MapPin,
  Package,
  ScanLine,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

const ONBOARDING_KEY = 'onboarded_v1'

export function shouldShowOnboarding(userId) {
  try {
    return !localStorage.getItem(`${ONBOARDING_KEY}_${userId}`)
  } catch {
    return false
  }
}

export function markOnboardingDone(userId) {
  try {
    localStorage.setItem(`${ONBOARDING_KEY}_${userId}`, '1')
  } catch { /* */ }
}

// Passos diferentes por papel
function getSteps(role) {
  const base = [
    {
      icon: Sparkles,
      color: '#6366f1',
      bg: 'rgba(99,102,241,.1)',
      title: 'Bem-vindo ao Fundepar TI',
      description:
        'Este sistema centraliza o controle de patrimônio, movimentações e atendimento técnico. Vamos mostrar o essencial em 3 passos rápidos.',
      tip: null,
    },
    {
      icon: Search,
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,.1)',
      title: 'Rastreie qualquer equipamento',
      description:
        'Em Rastreio você vê onde está cada patrimônio agora, quem está com ele e todo o histórico de movimentações. Use o scanner para localizar pelo QR code.',
      tip: { icon: ScanLine, text: 'O ícone de scanner no topo abre a câmera direto.' },
    },
    {
      icon: KanbanSquare,
      color: '#10b981',
      bg: 'rgba(16,185,129,.1)',
      title: 'Abra e acompanhe chamados',
      description:
        'No Workflow você abre chamados de manutenção, acompanha o status e recebe atualizações em tempo real. Clique no sino para ver notificações.',
      tip: null,
    },
  ]

  if (role === 'admin' || role === 'tecnico') {
    return [
      base[0],
      {
        icon: ArrowRightLeft,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,.1)',
        title: 'Registre movimentações',
        description:
          'Em Movimentações você registra transferências de equipamentos entre salas, define responsáveis e acompanha o histórico completo por patrimônio.',
        tip: { icon: Package, text: 'Use o scanner em lote para mover vários de uma vez.' },
      },
      base[1],
      base[2],
      {
        icon: BarChart3,
        color: '#6366f1',
        bg: 'rgba(99,102,241,.1)',
        title: 'Dashboard e relatórios',
        description:
          'O Dashboard mostra indicadores em tempo real: chamados pendentes, equipamentos parados, fluxo por sala e tempo médio de resolução. Filtre por período.',
        tip: { icon: MapPin, text: 'Clique em qualquer sala no Mapa de Salas para ver o inventário.' },
      },
    ]
  }

  return base
}

export function Onboarding({ userId, role, onDone }) {
  const steps = getSteps(role)
  const [step, setStep] = useState(0)
  const current = steps[step]
  const Icon = current.icon
  const isLast = step === steps.length - 1

  const finish = () => {
    markOnboardingDone(userId)
    onDone()
  }

  return (
    <div className="onboarding-overlay" onClick={(e) => e.target === e.currentTarget && finish()}>
      <div className="onboarding-card">

        {/* Fechar */}
        <button className="onboarding-skip" onClick={finish} title="Pular tutorial">
          <X size={16} />
        </button>

        {/* Ícone central */}
        <div className="onboarding-icon-wrap" style={{ background: current.bg }}>
          <Icon size={36} style={{ color: current.color }} />
        </div>

        {/* Conteúdo */}
        <div className="onboarding-body">
          <h3 className="onboarding-title">{current.title}</h3>
          <p className="onboarding-desc">{current.description}</p>

          {current.tip && (
            <div className="onboarding-tip">
              <current.tip.icon size={13} />
              <span>{current.tip.text}</span>
            </div>
          )}
        </div>

        {/* Dots */}
        <div className="onboarding-dots">
          {steps.map((_, i) => (
            <button
              key={i}
              className={`onboarding-dot${i === step ? ' active' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Passo ${i + 1}`}
            />
          ))}
        </div>

        {/* Navegação */}
        <div className="onboarding-nav">
          {step > 0 ? (
            <button className="onboarding-btn-secondary" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={15} /> Anterior
            </button>
          ) : (
            <button className="onboarding-btn-secondary" onClick={finish}>
              Pular
            </button>
          )}

          {isLast ? (
            <button className="onboarding-btn-primary" onClick={finish}>
              Começar <ChevronRight size={15} />
            </button>
          ) : (
            <button className="onboarding-btn-primary" onClick={() => setStep(step + 1)}>
              Próximo <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
