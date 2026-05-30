import { useEffect, useRef, useState } from 'react'
import { Menu, Search, ScanLine, Sun, Moon, Bell, MapPin, Package, Ticket, X, ArrowLeft } from 'lucide-react'

export function Topbar({
  onToggleMobileMenu,
  onSearchChange,
  searchValue = '',
  onOpenScanner,
  onToggleNotif,
  notifBadge = 0,
  searchResults = null,
  onResultSelect,
  onSearchClear,
}) {
  const [dark, setDark] = useState(false)
  const [focused, setFocused] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const wrapperRef = useRef(null)
  const mobileInputRef = useRef(null)

  useEffect(() => {
    let saved = false
    try { saved = localStorage.getItem('dark_mode') === '1' } catch (e) { /* */ }
    setDark(saved)
    document.body.classList.toggle('dark', saved)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus mobile input when overlay opens
  useEffect(() => {
    if (mobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus()
    }
  }, [mobileSearchOpen])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.body.classList.toggle('dark', next)
    try { localStorage.setItem('dark_mode', next ? '1' : '0') } catch (e) { /* */ }
  }

  const showDropdown = focused && searchValue.length >= 2 && searchResults !== null

  const total = searchResults
    ? (searchResults.equipment?.length || 0) + (searchResults.rooms?.length || 0) + (searchResults.tickets?.length || 0)
    : 0

  const closeMobileSearch = () => {
    setMobileSearchOpen(false)
    onSearchClear?.()
  }

  const handleMobileResultSelect = (type, item) => {
    onResultSelect?.(type, item)
    setMobileSearchOpen(false)
    onSearchClear?.()
  }

  const mobileTotal = searchResults
    ? (searchResults.equipment?.length || 0) + (searchResults.rooms?.length || 0) + (searchResults.tickets?.length || 0)
    : 0

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <button
            id="mobile-menu-btn"
            className="btn-icon hidden-desktop"
            onClick={onToggleMobileMenu}
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>
          <div className="search-bar hidden-mobile" ref={wrapperRef} style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
            <Search size={16} />
            <input
              type="text"
              id="global-search"
              placeholder="Buscar equipamentos, salas, chamados..."
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onFocus={() => setFocused(true)}
              autoComplete="off"
            />
            {searchValue && (
              <button
                style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                onClick={() => { onSearchClear?.(); setFocused(false) }}
                tabIndex={-1}
              >
                <X size={14} />
              </button>
            )}
            {showDropdown && (
              <div className="global-search-dropdown">
                {total === 0 ? (
                  <div className="global-search-empty">Nenhum resultado para "{searchValue}"</div>
                ) : (
                  <>
                    {searchResults.equipment?.length > 0 && (
                      <div className="global-search-group">
                        <div className="global-search-group-label"><Package size={11} /> Equipamentos</div>
                        {searchResults.equipment.map((eq) => (
                          <button key={eq.id} className="global-search-item" onClick={() => { onResultSelect('equipment', eq); setFocused(false) }}>
                            <span className="global-search-name">{eq.name}</span>
                            {eq.asset_number && <span className="global-search-sub">PAT {eq.asset_number.toString().padStart(6, '0')}</span>}
                            {eq.room_name && <span className="global-search-room"><MapPin size={10} /> {eq.room_name}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.rooms?.length > 0 && (
                      <div className="global-search-group">
                        <div className="global-search-group-label"><MapPin size={11} /> Salas</div>
                        {searchResults.rooms.map((r) => (
                          <button key={r.id} className="global-search-item" onClick={() => { onResultSelect('room', r); setFocused(false) }}>
                            <span className="global-search-name">{r.name}</span>
                            {r.coordinator && <span className="global-search-sub">{r.coordinator}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.tickets?.length > 0 && (
                      <div className="global-search-group">
                        <div className="global-search-group-label"><Ticket size={11} /> Chamados</div>
                        {searchResults.tickets.map((t) => (
                          <button key={t.id} className="global-search-item" onClick={() => { onResultSelect('ticket', t); setFocused(false) }}>
                            <span className="global-search-name">{t.title}</span>
                            <span className="global-search-sub">{t.room_name || '—'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="topbar-actions">
          {/* Botão de busca mobile */}
          <button
            className="btn-icon hidden-desktop"
            onClick={() => setMobileSearchOpen(true)}
            title="Buscar"
            aria-label="Buscar"
          >
            <Search size={20} />
          </button>
          <button className="btn-icon" onClick={onOpenScanner} title="Escanear patrimônio">
            <ScanLine size={20} />
          </button>
          <button id="dark-mode-btn" className="btn-icon" onClick={toggleDark} title="Alternar tema">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button id="notif-btn" className="btn-icon" onClick={onToggleNotif} title="Notificações">
            <Bell size={20} />
            {notifBadge > 0 && (
              <span id="notif-badge">{notifBadge > 9 ? '9+' : notifBadge}</span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="mobile-search-overlay">
          <div className="mobile-search-topbar">
            <button
              className="btn-icon"
              onClick={closeMobileSearch}
              aria-label="Voltar"
              style={{ flexShrink: 0 }}
            >
              <ArrowLeft size={20} />
            </button>
            <input
              ref={mobileInputRef}
              type="text"
              className="mobile-search-input"
              placeholder="Buscar equipamentos, salas, chamados..."
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              autoComplete="off"
            />
            {searchValue && (
              <button
                className="btn-icon"
                onClick={() => onSearchClear?.()}
                aria-label="Limpar busca"
                style={{ flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="mobile-search-results">
            {searchValue.length < 2 ? (
              <div className="mobile-search-empty">Digite para buscar...</div>
            ) : searchResults === null ? (
              <div className="mobile-search-empty">Buscando...</div>
            ) : mobileTotal === 0 ? (
              <div className="mobile-search-empty">Nenhum resultado para "{searchValue}"</div>
            ) : (
              <>
                {searchResults.equipment?.length > 0 && (
                  <div className="mobile-search-group">
                    <div className="mobile-search-group-label"><Package size={11} /> Equipamentos</div>
                    {searchResults.equipment.map((eq) => (
                      <button
                        key={eq.id}
                        className="mobile-search-item"
                        onClick={() => handleMobileResultSelect('equipment', eq)}
                      >
                        <span className="mobile-search-item-name">{eq.name}</span>
                        <span className="mobile-search-item-sub">
                          {eq.asset_number && <>PAT {eq.asset_number.toString().padStart(6, '0')}</>}
                          {eq.room_name && <><MapPin size={10} /> {eq.room_name}</>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.rooms?.length > 0 && (
                  <div className="mobile-search-group">
                    <div className="mobile-search-group-label"><MapPin size={11} /> Salas</div>
                    {searchResults.rooms.map((r) => (
                      <button
                        key={r.id}
                        className="mobile-search-item"
                        onClick={() => handleMobileResultSelect('room', r)}
                      >
                        <span className="mobile-search-item-name">{r.name}</span>
                        {r.coordinator && (
                          <span className="mobile-search-item-sub">{r.coordinator}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.tickets?.length > 0 && (
                  <div className="mobile-search-group">
                    <div className="mobile-search-group-label"><Ticket size={11} /> Chamados</div>
                    {searchResults.tickets.map((t) => (
                      <button
                        key={t.id}
                        className="mobile-search-item"
                        onClick={() => handleMobileResultSelect('ticket', t)}
                      >
                        <span className="mobile-search-item-name">{t.title}</span>
                        <span className="mobile-search-item-sub">{t.room_name || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
