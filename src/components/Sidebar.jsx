import { NavLink } from 'react-router-dom'
import { LogOut, Download, LayoutGrid, ClipboardList, CircleUser, ArrowRightLeft, LayoutDashboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useNavPermissions } from '../contexts/NavPermissionsContext.jsx'
import { supabase } from '../lib/supabase.js'
import { NAV_PAGES } from '../config/navPages.js'

function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function useConferencePending(user) {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (user?.role !== 'coordenador' || !user?.coordinator_room?.id) return
    let cancelled = false
    supabase
      .from('room_conferences')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', user.coordinator_room.id)
      .eq('competencia', currentCompetencia())
      .then(({ count }) => {
        if (!cancelled) setPending((count ?? 0) === 0)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.role, user?.coordinator_room?.id])

  return pending
}

function usePWAInstall() {
  const [prompt, setPrompt] = useState(null)
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
  }
  return { canInstall: !!prompt, install }
}

export function Sidebar({ open, onLinkClick }) {
  const { user, signOut } = useAuth()
  const { permissions } = useNavPermissions()
  const { canInstall, install } = usePWAInstall()
  const conferencePending = useConferencePending(user)
  const role = user?.role || 'usuario'
  const avatarInitial = (user?.full_name || 'U').charAt(0).toUpperCase()
  const roleLabels = { admin: 'Admin', tecnico: 'Técnico', usuario: 'Usuário', coordenador: 'Coordenador' }

  const isCoordinator = role === 'coordenador'
  const coordSigla = user?.coordinator_room?.sigla || ''
  const brandSigla = isCoordinator ? (coordSigla || '...') : 'DVTI'

  let navItems
  if (isCoordinator && coordSigla) {
    const sl = coordSigla.toLowerCase()
    navItems = [
      { key: 'painel',          to: `/setor/${sl}`,                  icon: LayoutDashboard, label: 'Painel' },
      { key: 'inventario',      to: `/setor/${sl}/inventario`,       icon: LayoutGrid,      label: 'Inventário' },
      { key: 'movimentacoes',   to: `/setor/${sl}/movimentacoes`,    icon: ArrowRightLeft,  label: 'Movimentações' },
      { key: 'conferencias',    to: `/setor/${sl}/conferencias`,     icon: ClipboardList,   label: 'Conferências', badge: conferencePending },
      { separator: 'Conta' },
      { key: 'perfil',          to: '/perfil',                       icon: CircleUser,      label: 'Meu Perfil' },
    ]
  } else if (isCoordinator) {
    navItems = [
      { key: 'perfil', to: '/perfil', icon: CircleUser, label: 'Meu Perfil' },
    ]
  } else {
    const visiblePages = NAV_PAGES.filter((item) => {
      if (item.separator) return true
      if (item.alwaysVisible) return true
      return permissions[item.key]?.includes(role) ?? false
    })
    navItems = visiblePages.filter((item, i) => {
      if (!item.separator) return true
      for (let j = i + 1; j < visiblePages.length; j++) {
        if (!visiblePages[j].separator) return true
        break
      }
      return false
    })
  }

  return (
    <aside id="sidebar" className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <img
          src="/assets/logo_fundepar.png"
          alt="Fundepar"
          style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
        />
        <h1>
          Fundepar <span>{brandSigla}</span>
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
                badge={item.badge}
                onClick={onLinkClick}
              />
            ),
          )}
        </ul>
      </nav>

      {canInstall && (
        <button className="sidebar-install-btn" onClick={install}>
          <Download size={15} /> Instalar como App
        </button>
      )}

      <div id="sidebar-profile" className="sidebar-profile">
        <NavLink
          to="/perfil"
          className="sidebar-profile-link"
          title="Ver meu perfil"
          onClick={onLinkClick}
        >
          <div className="avatar" style={{ background: '#0c4a6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, userSelect: 'none', flexShrink: 0 }}>
            {avatarInitial}
          </div>
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

function SidebarItem({ to, icon, label, badge, onClick }) {
  return (
    <li>
      <NavLink
        to={to}
        end
        onClick={onClick}
        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
      >
        {icon} {label}
        {badge && (
          <span style={{
            marginLeft: 'auto',
            background: '#dc2626',
            color: '#fff',
            borderRadius: '50%',
            width: 8,
            height: 8,
            display: 'inline-block',
            flexShrink: 0,
          }} />
        )}
      </NavLink>
    </li>
  )
}
