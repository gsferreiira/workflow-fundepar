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

// Páginas carregadas sob demanda (code-splitting): cada rota vira seu próprio
// chunk, baixado só quando o usuário navega até ela. Isso reduz drasticamente o
// bundle inicial — antes todas as páginas (incl. Registro/Movimentacoes, que têm
// milhares de linhas) eram empacotadas juntas mesmo na tela de login.
// Helper para componentes exportados como named export.
const lazyNamed = (factory, name) =>
  lazy(() => factory().then((m) => ({ default: m[name] })));

const Login = lazyNamed(() => import("./pages/Login.jsx"), "Login");
const Inicio = lazyNamed(() => import("./pages/Inicio.jsx"), "Inicio");
const Workflow = lazyNamed(() => import("./pages/Workflow.jsx"), "Workflow");
const Equipamentos = lazyNamed(() => import("./pages/Equipamentos.jsx"), "Equipamentos");
const Movimentacoes = lazyNamed(() => import("./pages/Movimentacoes.jsx"), "Movimentacoes");
const Registro = lazyNamed(() => import("./pages/Registro.jsx"), "Registro");
const MapaSalas = lazyNamed(() => import("./pages/MapaSalas.jsx"), "MapaSalas");
const Salas = lazyNamed(() => import("./pages/Salas.jsx"), "Salas");
const Impressoras = lazyNamed(() => import("./pages/Impressoras.jsx"), "Impressoras");
const Usuarios = lazyNamed(() => import("./pages/Usuarios.jsx"), "Usuarios");
const Perfil = lazyNamed(() => import("./pages/Perfil.jsx"), "Perfil");
const Auditoria = lazyNamed(() => import("./pages/Auditoria.jsx"), "Auditoria");
const Permissoes = lazyNamed(() => import("./pages/Permissoes.jsx"), "Permissoes");
const MapaSetor = lazyNamed(() => import("./pages/MapaSetor.jsx"), "MapaSetor");
const MovimentacoesSetor = lazyNamed(() => import("./pages/MovimentacoesSetor.jsx"), "MovimentacoesSetor");
const ConferenciasSetor = lazyNamed(() => import("./pages/ConferenciasSetor.jsx"), "ConferenciasSetor");
const DashboardSetor = lazyNamed(() => import("./pages/DashboardSetor.jsx"), "DashboardSetor");
const Conferencias = lazyNamed(() => import("./pages/Conferencias.jsx"), "Conferencias");
const DashboardPatrimonio = lazyNamed(() => import("./pages/DashboardPatrimonio.jsx"), "DashboardPatrimonio");
const DashboardTI = lazyNamed(() => import("./pages/Dashboard.jsx"), "Dashboard");

function LoadingScreen() {
  return null;
}

function DashboardRoute() {
  const { user } = useAuth();
  if (user?.role === 'patrimonio') return <DashboardPatrimonio />;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardTI />
    </Suspense>
  );
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
  const { user, loading, recoverySession } = useAuth();
  if (loading) return <LoadingScreen />;
  // recoverySession: usuário ainda não definiu senha — manter na tela de login
  if (user && !recoverySession) return <Navigate to="/inicio" replace />;
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
              <Suspense fallback={<LoadingScreen />}>
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
                    <Route path="/dashboard" element={<DashboardRoute />} />
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
              </Suspense>
            </HashRouter>
          </NavPermissionsProvider>
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
