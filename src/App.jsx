import { lazy, Suspense } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useOutletContext,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { StoreProvider } from "./contexts/StoreContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import {
  NavPermissionsProvider,
  useNavPermissions,
} from "./contexts/NavPermissionsContext.jsx";
import { Layout } from "./components/Layout.jsx";
import { PWAUpdater } from "./components/PWAUpdater.jsx";
import { Login } from "./pages/Login.jsx";
import { Inicio } from "./pages/Inicio.jsx";
import { Workflow } from "./pages/Workflow.jsx";
import { Equipamentos } from "./pages/Equipamentos.jsx";
import { Movimentacoes } from "./pages/Movimentacoes.jsx";
import { Registro } from "./pages/Registro.jsx";
import { MapaSalas } from "./pages/MapaSalas.jsx";
import { Salas } from "./pages/Salas.jsx";
import { Impressoras } from "./pages/Impressoras.jsx";
import { Usuarios } from "./pages/Usuarios.jsx";
import { Perfil } from "./pages/Perfil.jsx";
import { Auditoria } from "./pages/Auditoria.jsx";
import { Permissoes } from "./pages/Permissoes.jsx";
import { MapaSetor } from "./pages/MapaSetor.jsx";
import { MovimentacoesSetor } from "./pages/MovimentacoesSetor.jsx";
import { ConferenciasSetor } from "./pages/ConferenciasSetor.jsx";
import { DashboardSetor } from "./pages/DashboardSetor.jsx";
import { Conferencias } from "./pages/Conferencias.jsx";

const Dashboard = lazy(() =>
  import("./pages/Dashboard.jsx").then((module) => ({
    default: module.Dashboard,
  })),
);

function LoadingScreen() {
  return null;
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Protege rotas por permissão dinâmica (lida do banco via NavPermissionsContext)
function RoleRoute({ pageKey }) {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useNavPermissions();
  const ctx = useOutletContext();
  if (authLoading || permLoading) return <LoadingScreen />;
  const allowed = permissions[pageKey]?.includes(user?.role) ?? false;
  if (!allowed) return <Navigate to="/inicio" replace />;
  return <Outlet context={ctx} />;
}

function PublicRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/inicio" replace />;
  return <Outlet />;
}

// Redireciona coordenador para a view do seu setor; outros papéis renderizam normalmente
function TiOnlyRedirect({ element }) {
  const { user } = useAuth();
  if (user?.role === 'coordenador') {
    const sigla = user.coordinator_room?.sigla?.toLowerCase();
    return <Navigate to={sigla ? `/setor/${sigla}` : '/perfil'} replace />;
  }
  return element;
}

function App() {
  return (
    <ToastProvider>
      <PWAUpdater />
      <AuthProvider>
        <StoreProvider>
          <NavPermissionsProvider>
            <HashRouter>
              <Routes>
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<Login />} />
                </Route>
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route
                      path="/"
                      element={<TiOnlyRedirect element={<Navigate to="/inicio" replace />} />}
                    />
                    <Route path="/inicio" element={<TiOnlyRedirect element={<Inicio />} />} />
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
                    <Route path="/registro" element={<Registro />} />
                    <Route path="/rastreio" element={<Navigate to="/registro" replace />} />
                    <Route path="/mapa-salas" element={<MapaSalas />} />
                    <Route element={<RoleRoute pageKey="salas" />}>
                      <Route path="/salas" element={<Salas />} />
                    </Route>
                    <Route element={<RoleRoute pageKey="impressoras" />}>
                      <Route path="/impressoras" element={<Impressoras />} />
                    </Route>
                    <Route element={<RoleRoute pageKey="usuarios" />}>
                      <Route path="/usuarios" element={<Usuarios />} />
                    </Route>
                    <Route element={<RoleRoute pageKey="conferencias" />}>
                      <Route path="/conferencias" element={<Conferencias />} />
                    </Route>
                    <Route element={<RoleRoute pageKey="auditoria" />}>
                      <Route path="/auditoria" element={<Auditoria />} />
                    </Route>
                    <Route element={<RoleRoute pageKey="permissoes" />}>
                      <Route path="/permissoes" element={<Permissoes />} />
                    </Route>
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/setor/:sigla" element={<DashboardSetor />} />
                    <Route path="/setor/:sigla/inventario" element={<MapaSetor />} />
                    <Route path="/setor/:sigla/movimentacoes" element={<MovimentacoesSetor />} />
                    <Route path="/setor/:sigla/conferencias" element={<ConferenciasSetor />} />
                    <Route
                      path="*"
                      element={
                        <div style={{ textAlign: "center", padding: 40 }}>
                          <h2>Erro 404</h2>
                          <p style={{ color: "var(--text-secondary)" }}>
                            A tela procurada não existe.
                          </p>
                        </div>
                      }
                    />
                  </Route>
                </Route>
              </Routes>
            </HashRouter>
          </NavPermissionsProvider>
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
