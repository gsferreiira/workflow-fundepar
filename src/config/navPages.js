import {
  Home, LayoutDashboard, KanbanSquare, Package, ArrowRightLeft,
  Search, LayoutGrid, MapPin, Users, ShieldCheck, Lock, CircleUser, ClipboardList,
} from 'lucide-react'

// Metadados de cada página — as permissões ficam no banco (app_settings).
// alwaysVisible: aparece para todos sem entrar na matrix de permissões.
// locked: não pode ser desmarcado na tela de Permissões (trava de segurança).
export const NAV_PAGES = [
  { key: 'inicio',        to: '/inicio',        icon: Home,            label: 'Início' },
  { key: 'dashboard',     to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'workflow',      to: '/workflow',      icon: KanbanSquare,    label: 'Workflow (Kanban)' },

  { separator: 'Patrimônio' },

  { key: 'equipamentos',  to: '/equipamentos',  icon: Package,         label: 'Equipamentos' },
  { key: 'movimentacoes', to: '/movimentacoes', icon: ArrowRightLeft,  label: 'Movimentações' },
  { key: 'rastreio',      to: '/registro',      icon: Search,          label: 'Registro' },
  { key: 'mapa-salas',    to: '/mapa-salas',    icon: LayoutGrid,      label: 'Mapa de Salas' },

  { separator: 'Administração' },

  { key: 'salas',         to: '/salas',         icon: MapPin,          label: 'Cadastro de Salas' },
  { key: 'usuarios',      to: '/usuarios',      icon: Users,           label: 'Cadastro de Usuários' },
  { key: 'conferencias',  to: '/conferencias',  icon: ClipboardList,   label: 'Conferências' },
  { key: 'auditoria',     to: '/auditoria',     icon: ShieldCheck,     label: 'Auditoria' },
  { key: 'permissoes',    to: '/permissoes',    icon: Lock,            label: 'Permissões',  locked: true },

  // Perfil é sempre visível — não entra na matrix
  { key: 'perfil',        to: '/perfil',        icon: CircleUser,      label: 'Meu Perfil',  alwaysVisible: true },
]

// Permissões padrão (usadas como fallback antes de carregar do banco)
export const DEFAULT_PERMISSIONS = {
  inicio:        ['admin', 'tecnico', 'usuario', 'coordenador'],
  dashboard:     ['admin', 'tecnico', 'usuario'],
  workflow:      ['admin', 'tecnico', 'usuario'],
  equipamentos:  ['admin', 'tecnico', 'usuario'],
  movimentacoes: ['admin', 'tecnico', 'usuario'],
  rastreio:      ['admin', 'tecnico', 'usuario'],
  'mapa-salas':  ['admin', 'tecnico', 'usuario'],
  salas:         ['admin'],
  usuarios:      ['admin'],
  conferencias:  ['admin', 'tecnico'],
  auditoria:     ['admin'],
  permissoes:    ['admin'],
}
