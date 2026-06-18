import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { X, MapPin, Loader2, RefreshCw } from 'lucide-react'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'
import {
  NotificationsPanel,
  NotificationDetailModal,
  useNotifications,
  useAlerts,
} from './Notifications.jsx'
import { Scanner, ScanResultModal } from './Scanner.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { supabase } from '../lib/supabase.js'
import { debounce } from '../utils/format.js'
import { Onboarding, shouldShowOnboarding } from './Onboarding.jsx'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { useRoomNotifications } from '../hooks/useRoomNotifications.js'

// Contexto compartilhado com as páginas — value vem do <Outlet context={...}/>
import { createContext, useContext } from 'react'
const LayoutContext = createContext(null)
export const useLayout = () => useContext(LayoutContext)

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifDetail, setNotifDetail] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [locateAsset, setLocateAsset] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { rooms: roomsFetcher } = useStore()
  const [rooms, setRooms] = useState([])
  const { items, badge, seenAt, refresh, markAsSeen } = useNotifications({
    roomId: user?.role === 'coordenador' ? user?.coordinator_room?.id : undefined,
  })
  const { alerts, alertCount } = useAlerts({ role: user?.role })
  const { notifications: roomNotifs, dismiss: dismissRoomNotif } = useRoomNotifications(user)
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding(user?.id))
  const refreshFnRef = useRef(null)
  const registerRefresh = useCallback((fn) => { refreshFnRef.current = fn }, [])
  const { state: pullState } = usePullToRefresh(() => refreshFnRef.current?.())

  useEffect(() => {
    roomsFetcher().then(setRooms).catch(() => {})
  }, [roomsFetcher])

  // Debounce do search e reset entre rotas.
  // O debouncer é criado UMA VEZ via useMemo. Antes era criado a cada render
  // do useEffect, o que zerava o timer interno e o debounce nunca disparava.
  const debouncedSetSearch = useMemo(() => debounce((v) => setSearchDebounced(v), 250), [])
  useEffect(() => {
    debouncedSetSearch(search)
  }, [search, debouncedSetSearch])

  useEffect(() => {
    setSearch('')
    setSearchDebounced('')
    setSearchResults(null)
    setSidebarOpen(false)
  }, [location.pathname])

  // Busca global — dispara quando searchDebounced tem >= 2 chars
  useEffect(() => {
    if (searchDebounced.length < 2) { setSearchResults(null); return }
    let cancelled = false
    const q = searchDebounced.toLowerCase()
    const run = async () => {
      const [{ data: eqLoc }, { data: rooms }, { data: tickets }] = await Promise.all([
        supabase
          .from('asset_movements')
          .select('equipment_id, equipment(id,name,categoria), asset_number, destination_room_id, destination_room:destination_room_id(name)')
          .is('deleted_at', null)
          .order('moved_at', { ascending: false })
          .limit(300),
        supabase.from('rooms').select('id, name, coordinator').is('deleted_at', null).ilike('name', `%${searchDebounced}%`).limit(5),
        supabase.from('tickets').select('id, title, status, room:room_id(name)').is('deleted_at', null).ilike('title', `%${searchDebounced}%`).limit(5),
      ])
      if (cancelled) return

      // Equipamentos — deduplica por asset_number e filtra pelo query
      const seen = new Set()
      const equipment = []
      for (const m of eqLoc || []) {
        const key = m.asset_number || m.equipment_id
        if (seen.has(key)) continue
        const name = m.equipment?.name || ''
        const assetStr = m.asset_number?.toString() || ''
        if (!name.toLowerCase().includes(q) && !assetStr.includes(q)) continue
        seen.add(key)
        equipment.push({ id: m.equipment_id, name, asset_number: m.asset_number, room_name: m.destination_room?.name })
        if (equipment.length >= 5) break
      }

      if (cancelled) return
      setSearchResults({
        equipment,
        rooms: (rooms || []).map(r => ({ ...r, room_name: r.name })),
        tickets: (tickets || []).map(t => ({ ...t, room_name: t.room?.name })),
      })
    }
    run().catch(() => { if (!cancelled) setSearchResults(null) })
    return () => { cancelled = true }
  }, [searchDebounced])

  const toggleSidebar = () => setSidebarOpen((o) => !o)
  const closeSidebar = () => setSidebarOpen(false)

  const clearSearch = useCallback(() => {
    setSearch('')
    setSearchDebounced('')
    setSearchResults(null)
  }, [])

  const handleResultSelect = useCallback((type, item) => {
    clearSearch()
    if (type === 'equipment') navigate(`/registro`)
    else if (type === 'room') navigate(`/mapa-salas`)
    else if (type === 'ticket') navigate(`/workflow`)
  }, [navigate, clearSearch])

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
    navigate('/registro', { state: { newRegistroAsset: asset } })
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
    registerRefresh,
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
              notifBadge={badge + alertCount}
              searchResults={searchResults}
              onResultSelect={handleResultSelect}
              onSearchClear={clearSearch}
            />
            <NotificationsPanel
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
              items={items}
              seenAt={seenAt}
              alerts={alerts}
              onShowDetail={(item) => {
                setNotifOpen(false)
                setNotifDetail(item)
              }}
            />
            <div id="view-content" className="view-content fade-in">
              <ErrorBoundary>
                <Outlet context={layoutValue} />
              </ErrorBoundary>
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
      {showOnboarding && user?.id && (
        <Onboarding
          userId={user.id}
          role={user.role}
          onDone={() => setShowOnboarding(false)}
        />
      )}
      {locateAsset && (
        <QuickLocateModal
          assetNumber={locateAsset}
          rooms={rooms}
          userId={user?.id}
          onClose={() => setLocateAsset(null)}
          onSaved={(roomName) => {
            setLocateAsset(null)
            showToast(`Localização de ${locateAsset} registrada em "${roomName}".`, 'success')
          }}
          onRegisterMovement={() => {
            const asset = locateAsset
            setLocateAsset(null)
            navigate('/movimentacoes', { state: { openCreateModal: { prefillAsset: asset } } })
          }}
        />
      )}
      <RoomNotificationStack notifications={roomNotifs} onDismiss={dismissRoomNotif} user={user} />

      {pullState !== 'idle' && (
        <div className={`pull-indicator ${pullState}`}>
          {pullState === 'refreshing'
            ? <Loader2 size={18} className="spin" />
            : <RefreshCw size={18} style={{ transform: pullState === 'release' ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          }
        </div>
      )}
    </LayoutContext.Provider>
  )
}

function RoomNotificationStack({ notifications, onDismiss, user }) {
  const [reportingId, setReportingId] = useState(null)
  const [ticketMsg, setTicketMsg]     = useState('')
  const [sending, setSending]         = useState(false)
  const { showToast } = useToast()
  const navigate = useNavigate()

  if (!notifications.length) return null

  const handleReport = async (notif) => {
    setSending(true)
    const title = `Movimentação indevida: ${notif.equipmentName}${notif.assetNumber ? ` (Pat. ${notif.assetNumber})` : ''}`
    const description = [
      `Equipamento: ${notif.equipmentName}`,
      notif.assetNumber ? `Patrimônio: ${notif.assetNumber}` : '',
      ticketMsg.trim() ? `\nDetalhes: ${ticketMsg.trim()}` : '',
    ].filter(Boolean).join('\n')

    const { error } = await supabase.from('tickets').insert({
      title,
      description,
      room_id:      user?.coordinator_room?.id || null,
      requester_id: user?.id || null,
      status:       'aberto',
    })
    setSending(false)
    if (error) { showToast('Erro ao abrir chamado.', 'danger'); return }
    showToast('Chamado aberto! O TI foi notificado.', 'success')
    setReportingId(null)
    setTicketMsg('')
    onDismiss(notif.id)
    navigate('/workflow')
  }

  const fmtTime = (iso) => {
    try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, width: 'calc(100vw - 48px)' }}>
      {notifications.map((notif) => (
        <div key={notif.id} style={{ background: 'var(--bg-card)', border: '1px solid rgba(99,102,241,.3)', borderLeft: '4px solid #6366f1', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,.12)', padding: '14px 16px', animation: 'fadeIn .25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 2 }}>
                📦 Novo equipamento recebido
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {notif.equipmentName}
              </div>
              {notif.assetNumber && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                  Patrimônio: {notif.assetNumber}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {fmtTime(notif.movedAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(notif.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          {reportingId === notif.id ? (
            <div style={{ marginTop: 10 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Descreva o problema (opcional)..."
                value={ticketMsg}
                onChange={(e) => setTicketMsg(e.target.value)}
                style={{ fontSize: 12, marginBottom: 8 }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, flex: 1 }}
                  onClick={() => { setReportingId(null); setTicketMsg('') }}
                  disabled={sending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 12, flex: 1 }}
                  onClick={() => handleReport(notif)}
                  disabled={sending}
                >
                  {sending ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, flex: 1 }}
                onClick={() => { setReportingId(notif.id); setTicketMsg('') }}
              >
                Contatar TI
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 12, flex: 1 }}
                onClick={() => onDismiss(notif.id)}
              >
                Tudo certo
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function QuickLocateModal({ assetNumber, rooms, userId, onClose, onSaved, onRegisterMovement }) {
  const [roomId, setRoomId] = useState('')
  const [busy, setBusy] = useState(false)

  const roomsSorted = [...rooms].sort((a, b) => a.name.localeCompare(b.name))

  const handleSave = async () => {
    if (!roomId) return
    setBusy(true)
    const room = rooms.find(r => r.id === roomId)
    const { error } = await supabase.from('asset_movements').insert({
      asset_number: assetNumber,
      destination_room_id: roomId,
      moved_by: userId,
      moved_at: new Date().toISOString(),
    })
    setBusy(false)
    if (error) return
    onSaved(room?.name || roomId)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div>
            <h3>Patrimônio sem localização</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              PAT: <strong>{assetNumber}</strong>
            </div>
          </div>
          <button className="modal-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Este patrimônio não possui histórico de movimentação. Selecione a sala onde ele está agora para registrar sua localização.
        </p>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={13} /> Onde está agora?
          </label>
          <select className="form-control" value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">Selecione a sala...</option>
            {roomsSorted.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            className="btn-primary"
            style={{ background: '#e2e8f0', color: '#475569', flex: 1 }}
            onClick={onRegisterMovement}
          >
            Movimentação completa
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={!roomId || busy}
            onClick={handleSave}
          >
            {busy ? <Loader2 size={14} className="spin" /> : 'Registrar localização'}
          </button>
        </div>
      </div>
    </div>
  )
}
