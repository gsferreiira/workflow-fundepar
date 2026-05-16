import { useEffect, useState } from 'react'
import { Menu, Search, ScanLine, Sun, Moon, Bell } from 'lucide-react'

export function Topbar({
  onToggleMobileMenu,
  onSearchChange,
  searchValue = '',
  onOpenScanner,
  onToggleNotif,
  notifBadge = 0,
}) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    let saved = false
    try {
      saved = localStorage.getItem('dark_mode') === '1'
    } catch (e) { /* localStorage indisponível */ }
    setDark(saved)
    document.body.classList.toggle('dark', saved)
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.body.classList.toggle('dark', next)
    try {
      localStorage.setItem('dark_mode', next ? '1' : '0')
    } catch (e) { /* sem persistência se localStorage falhar */ }
  }

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          id="mobile-menu-btn"
          className="btn-icon hidden-desktop"
          onClick={onToggleMobileMenu}
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            id="global-search"
            placeholder="Pesquisar..."
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>
      <div className="topbar-actions">
        <button className="btn-icon" onClick={onOpenScanner} title="Escanear patrimônio">
          <ScanLine size={20} />
        </button>
        <button
          id="dark-mode-btn"
          className="btn-icon"
          onClick={toggleDark}
          title="Alternar tema"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button id="notif-btn" className="btn-icon" onClick={onToggleNotif} title="Notificações">
          <Bell size={20} />
          {notifBadge > 0 && (
            <span id="notif-badge" style={{}}>
              {notifBadge > 9 ? '9+' : notifBadge}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
