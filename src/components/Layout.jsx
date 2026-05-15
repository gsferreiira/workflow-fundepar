import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'
import {
  NotificationsPanel,
  NotificationDetailModal,
  useNotifications,
} from './Notifications.jsx'
import { Scanner, ScanResultModal } from './Scanner.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { debounce } from '../utils/format.js'

// Contexto compartilhado com as páginas — value vem do <Outlet context={...}/>
import { createContext, useContext } from 'react'
const LayoutContext = createContext(null)
export const useLayout = () => useContext(LayoutContext)

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifDetail, setNotifDetail] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const { items, badge, refresh, markAsSeen } = useNotifications()

  // Debounce do search e reset entre rotas
  useEffect(() => {
    const d = debounce((v) => setSearchDebounced(v), 250)
    d(search)
  }, [search])

  useEffect(() => {
    setSearch('')
    setSearchDebounced('')
    setSidebarOpen(false)
  }, [location.pathname])

  const toggleSidebar = () => setSidebarOpen((o) => !o)
  const closeSidebar = () => setSidebarOpen(false)

  const toggleNotif = () => {
    if (notifOpen) {
      setNotifOpen(false)
    } else {
      markAsSeen()
      setNotifOpen(true)
    }
  }

  const openScanner = () => {
    setScannerOpen(true)
  }

  const handleMaquinaLocalizada = (mov, asset) => {
    setScannerOpen(false)
    setScanResult({ mov, asset })
  }

  const handleSemHistorico = (asset) => {
    setScannerOpen(false)
    // Navega para movimentações e abre modal com pré-preenchimento
    navigate('/movimentacoes', { state: { openCreateModal: { prefillAsset: asset } } })
  }

  const handleScanRegistrar = () => {
    const { mov, asset } = scanResult
    setScanResult(null)
    navigate('/movimentacoes', {
      state: {
        openCreateModal: {
          prefillAsset: asset,
          prefillOriginId: mov.destination_room?.id || '',
          prefillOriginName: mov.destination_room?.name || '',
        },
      },
    })
  }

  const layoutValue = {
    search: searchDebounced,
    setSearch,
    openScanner,
    refreshNotifications: refresh,
  }

  return (
    <LayoutContext.Provider value={layoutValue}>
      <div id="app">
        <div id="app-container" className="app-container">
          <Sidebar open={sidebarOpen} onLinkClick={closeSidebar} />
          <main className="main-content">
            <Topbar
              onToggleMobileMenu={toggleSidebar}
              onSearchChange={setSearch}
              searchValue={search}
              onOpenScanner={openScanner}
              onToggleNotif={toggleNotif}
              notifBadge={badge}
            />
            <NotificationsPanel
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
              items={items}
              onShowDetail={(item) => {
                setNotifOpen(false)
                setNotifDetail(item)
              }}
            />
            <div id="view-content" className="view-content fade-in">
              <Outlet context={layoutValue} />
            </div>
          </main>
        </div>
        <div
          id="sidebar-backdrop"
          className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`}
          onClick={closeSidebar}
        ></div>
      </div>
      {scannerOpen && (
        <Scanner
          open={scannerOpen}
          mode="single"
          onClose={() => setScannerOpen(false)}
          onMaquinaLocalizada={handleMaquinaLocalizada}
          onSemHistorico={handleSemHistorico}
        />
      )}
      {scanResult && (
        <ScanResultModal
          movement={scanResult.mov}
          assetNumber={scanResult.asset}
          onClose={() => setScanResult(null)}
          onRegistrar={handleScanRegistrar}
        />
      )}
      {notifDetail && (
        <NotificationDetailModal item={notifDetail} onClose={() => setNotifDetail(null)} />
      )}
    </LayoutContext.Provider>
  )
}
