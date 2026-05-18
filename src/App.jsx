import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { StoreProvider } from './contexts/StoreContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { Layout } from './components/Layout.jsx'
import { PWAUpdater } from './components/PWAUpdater.jsx'
import { Login } from './pages/Login.jsx'
import { Inicio } from './pages/Inicio.jsx'
import { Workflow } from './pages/Workflow.jsx'
import { Equipamentos } from './pages/Equipamentos.jsx'
import { Movimentacoes } from './pages/Movimentacoes.jsx'
import { Rastreio } from './pages/Rastreio.jsx'
import { MapaSalas } from './pages/MapaSalas.jsx'
import { Salas } from './pages/Salas.jsx'
import { Usuarios } from './pages/Usuarios.jsx'
import { Perfil } from './pages/Perfil.jsx'
import { Auditoria } from './pages/Auditoria.jsx'

const Dashboard = lazy(() =>
  import('./pages/Dashboard.jsx').then((module) => ({ default: module.Dashboard })),
)

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
      }}
    >
      <div className="skel skel-card" style={{ width: 320, height: 120 }}></div>
    </div>
  )
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/inicio" replace />
  return <Outlet />
}

function App() {
  return (
    <ToastProvider>
      <PWAUpdater />
      <AuthProvider>
        <StoreProvider>
          <HashRouter>
            <Routes>
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<Login />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Navigate to="/inicio" replace />} />
                  <Route path="/inicio" element={<Inicio />} />
                  <Route
                    path="/dashboard"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <Dashboard />
                      </Suspense>
                    }
                  />
                  <Route path="/workflow" element={<Workflow />} />
                  <Route path="/equipamentos" element={<Equipamentos />} />
                  <Route path="/movimentacoes" element={<Movimentacoes />} />
                  <Route path="/rastreio" element={<Rastreio />} />
                  <Route path="/mapa-salas" element={<MapaSalas />} />
                  <Route path="/salas" element={<Salas />} />
                  <Route path="/usuarios" element={<Usuarios />} />
                  <Route path="/perfil" element={<Perfil />} />
                  <Route path="/auditoria" element={<Auditoria />} />
                  <Route
                    path="*"
                    element={
                      <div style={{ textAlign: 'center', padding: 40 }}>
                        <h2>Erro 404</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                          A tela procurada não existe.
                        </p>
                      </div>
                    }
                  />
                </Route>
              </Route>
            </Routes>
          </HashRouter>
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
