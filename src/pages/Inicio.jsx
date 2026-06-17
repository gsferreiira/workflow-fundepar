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
  Printer,
  ClipboardList,
  Lock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useNavPermissions } from '../contexts/NavPermissionsContext.jsx'

const ALL_MODULES = [
  { pageKey: 'dashboard',     to: '/dashboard',     icon: BarChart3,     title: 'Dashboard',        description: 'Acompanhe indicadores, gráficos e últimas movimentações.' },
  { pageKey: 'workflow',      to: '/workflow',       icon: KanbanSquare,  title: 'Workflow',         description: 'Gerencie chamados por status no painel Kanban.' },
  { pageKey: 'equipamentos',  to: '/equipamentos',   icon: Package,       title: 'Equipamentos',     description: 'Cadastre e organize os equipamentos disponíveis.' },
  { pageKey: 'movimentacoes', to: '/movimentacoes',  icon: ArrowRightLeft, title: 'Movimentações',  description: 'Registre transferências, responsáveis e patrimônios.' },
  { pageKey: 'rastreio',      to: '/registro',       icon: Search,        title: 'Registro',         description: 'Localize patrimônios e consulte o histórico de uso.' },
  { pageKey: 'mapa-salas',    to: '/mapa-salas',     icon: LayoutGrid,    title: 'Mapa de Salas',   description: 'Veja a distribuição atual dos itens por local.' },
  { pageKey: 'salas',         to: '/salas',          icon: MapPin,        title: 'Salas',            description: 'Mantenha o cadastro de locais atualizado.' },
  { pageKey: 'impressoras',   to: '/impressoras',    icon: Printer,       title: 'Impressoras',      description: 'Gerencie impressoras e seus vínculos com patrimônio.' },
  { pageKey: 'usuarios',      to: '/usuarios',       icon: Users,         title: 'Usuários',         description: 'Administre perfis e acessos ao sistema.' },
  { pageKey: 'conferencias',  to: '/conferencias',   icon: ClipboardList, title: 'Conferências',     description: 'Acompanhe as conferências mensais dos setores.' },
  { pageKey: 'auditoria',     to: '/auditoria',      icon: ShieldCheck,   title: 'Auditoria',        description: 'Consulte ações registradas e alterações sensíveis.' },
  { pageKey: 'permissoes',    to: '/permissoes',     icon: Lock,          title: 'Permissões',       description: 'Configure o acesso de cada perfil ao sistema.' },
]

export function Inicio() {
  const { user } = useAuth()
  const { permissions } = useNavPermissions()
  const role = user?.role || 'usuario'

  const visibleModules = ALL_MODULES.filter((m) =>
    permissions[m.pageKey]?.includes(role) ?? false,
  )

  return (
    <>
      <div className="home-hero fade-in">
        <div>
          <h2>Olá, {user?.full_name || 'Usuário'}</h2>
          <p>
            Este sistema centraliza o controle de workflow, patrimônio, movimentações e
            registro de equipamentos da Fundepar TI.
          </p>
        </div>
      </div>

      <div className="home-module-grid fade-in">
        {visibleModules.map((module) => {
          const Icon = module.icon
          return (
            <Link to={module.to} className="home-module-card" key={module.pageKey}>
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
