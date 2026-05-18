import { NavLink } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  KanbanSquare,
  Package,
  ArrowRightLeft,
  Search,
  LayoutGrid,
  MapPin,
  Users,
  ShieldCheck,
  CircleUser,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

export function Sidebar({ open, onLinkClick }) {
  const { user, signOut } = useAuth()
  const isAdmin = user?.role === 'admin'
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'U')}&background=0c4a6e&color=fff`
  const roleLabels = { admin: 'Admin', tecnico: 'Técnico', usuario: 'Usuário' }
  const roleLabel = roleLabels[user?.role] || 'Usuário'

  return (
    <aside id="sidebar" className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div
          style={{
            background: 'var(--primary-color)',
            color: 'white',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 'bold',
            borderRadius: 8,
          }}
        >
          F
        </div>
        <h1>
          Fundepar <span>TI</span>
        </h1>
      </div>

      <nav className="sidebar-menu">
        <ul>
          <SidebarItem to="/inicio" icon={<Home />} label="Início" onClick={onLinkClick} />
          <SidebarItem to="/dashboard" icon={<LayoutDashboard />} label="Dashboard" onClick={onLinkClick} />
          <SidebarItem to="/workflow" icon={<KanbanSquare />} label="Workflow (Kanban)" onClick={onLinkClick} />
          <li className="separator">Patrimônio</li>
          <SidebarItem to="/equipamentos" icon={<Package />} label="Equipamentos" onClick={onLinkClick} />
          <SidebarItem to="/movimentacoes" icon={<ArrowRightLeft />} label="Movimentações" onClick={onLinkClick} />
          <SidebarItem to="/rastreio" icon={<Search />} label="Rastreio" onClick={onLinkClick} />
          <SidebarItem to="/mapa-salas" icon={<LayoutGrid />} label="Mapa de Salas" onClick={onLinkClick} />
          <li className="separator">Administração</li>
          <SidebarItem to="/salas" icon={<MapPin />} label="Cadastro de Salas" onClick={onLinkClick} />
          <SidebarItem to="/usuarios" icon={<Users />} label="Cadastro de Usuários" onClick={onLinkClick} />
          {isAdmin && (
            <SidebarItem to="/auditoria" icon={<ShieldCheck />} label="Auditoria" onClick={onLinkClick} />
          )}
          <SidebarItem to="/perfil" icon={<CircleUser />} label="Meu Perfil" onClick={onLinkClick} />
        </ul>
      </nav>

      <div id="sidebar-profile" className="sidebar-profile">
        <NavLink to="/perfil" className="sidebar-profile-link" title="Ver meu perfil" onClick={onLinkClick}>
          <img src={avatarUrl} alt="Avatar" className="avatar" />
          <div className="profile-info">
            <div className="name" title={user?.full_name || ''}>
              {user?.full_name || '—'}
            </div>
            <div className="role">{roleLabel}</div>
          </div>
        </NavLink>
        <button className="btn-logout" onClick={signOut} title="Sair do Sistema">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

function SidebarItem({ to, icon, label, onClick }) {
  return (
    <li>
      <NavLink
        to={to}
        end
        onClick={onClick}
        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
      >
        {icon} {label}
      </NavLink>
    </li>
  )
}
