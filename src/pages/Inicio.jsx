import {
  ArrowRightLeft,
  BarChart3,
  KanbanSquare,
  LayoutGrid,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const modules = [
  {
    to: '/dashboard',
    icon: BarChart3,
    title: 'Dashboard',
    description: 'Acompanhe indicadores, gráficos e últimas movimentações.',
  },
  {
    to: '/workflow',
    icon: KanbanSquare,
    title: 'Workflow',
    description: 'Gerencie chamados por status no painel Kanban.',
  },
  {
    to: '/equipamentos',
    icon: Package,
    title: 'Equipamentos',
    description: 'Cadastre e organize os equipamentos disponíveis.',
  },
  {
    to: '/movimentacoes',
    icon: ArrowRightLeft,
    title: 'Movimentações',
    description: 'Registre transferências, responsáveis e patrimônios.',
  },
  {
    to: '/rastreio',
    icon: Search,
    title: 'Rastreio',
    description: 'Localize patrimônios e consulte o histórico de uso.',
  },
  {
    to: '/mapa-salas',
    icon: LayoutGrid,
    title: 'Mapa de Salas',
    description: 'Veja a distribuição atual dos itens por local.',
  },
  {
    to: '/salas',
    icon: MapPin,
    title: 'Salas',
    description: 'Mantenha o cadastro de locais atualizado.',
  },
  {
    to: '/usuarios',
    icon: Users,
    title: 'Usuários',
    description: 'Administre perfis e acessos ao sistema.',
  },
]

export function Inicio() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const visibleModules = isAdmin
    ? [
        ...modules,
        {
          to: '/auditoria',
          icon: ShieldCheck,
          title: 'Auditoria',
          description: 'Consulte ações registradas e alterações sensíveis.',
        },
      ]
    : modules

  return (
    <>
      <div className="home-hero fade-in">
        <div>
          <h2>Olá, {user?.full_name || 'Usuário'}</h2>
          <p>
            Este sistema centraliza o controle de workflow, patrimônio, movimentações e
            rastreio de equipamentos da Fundepar TI.
          </p>
        </div>
      </div>

      <div className="home-module-grid fade-in">
        {visibleModules.map((module) => {
          const Icon = module.icon
          return (
            <Link to={module.to} className="home-module-card" key={module.to}>
              <div className="home-module-icon">
                <Icon size={20} />
              </div>
              <div>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
