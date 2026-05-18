import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useNavPermissions } from '../contexts/NavPermissionsContext.jsx'
import { NAV_PAGES } from '../config/navPages.js'

export function Sidebar({ open, onLinkClick }) {
  const { user, signOut } = useAuth()
  const { permissions } = useNavPermissions()
  const role = user?.role || 'usuario'
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'U')}&background=0c4a6e&color=fff`
  const roleLabels = { admin: 'Admin', tecnico: 'Técnico', usuario: 'Usuário' }

  // Filtra as páginas que o role atual pode ver
  const visiblePages = NAV_PAGES.filter((item) => {
    if (item.separator) return true // separadores são avaliados abaixo
    if (item.alwaysVisible) return true
    return permissions[item.key]?.includes(role) ?? false
  })

  // Remove separadores que não têm nenhuma página visível após eles
  const navItems = visiblePages.filter((item, i) => {
    if (!item.separator) return true
    for (let j = i + 1; j < visiblePages.length; j++) {
      if (!visiblePages[j].separator) return true
      break
    }
    return false
  })

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
          {navItems.map((item, i) =>
            item.separator ? (
              <li key={`sep-${i}`} className="separator">
                {item.separator}
              </li>
            ) : (
              <SidebarItem
                key={item.key}
                to={item.to}
                icon={<item.icon />}
                label={item.label}
                onClick={onLinkClick}
              />
            ),
          )}
        </ul>
      </nav>

      <div id="sidebar-profile" className="sidebar-profile">
        <NavLink
          to="/perfil"
          className="sidebar-profile-link"
          title="Ver meu perfil"
          onClick={onLinkClick}
        >
          <img src={avatarUrl} alt="Avatar" className="avatar" />
          <div className="profile-info">
            <div className="name" title={user?.full_name || ''}>
              {user?.full_name || '—'}
            </div>
            <div className="role">{roleLabels[role] || 'Usuário'}</div>
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
