// app.js — Núcleo da aplicação.
// Contém os helpers globais (UI, App.handleRoute, etc) e o objeto vazio
// App.modules = {} que é populado pelos arquivos em modules/.

const UI = {
  showToast: (message, type = "success") => {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    let icon = "info";
    if (type === "success") icon = "check-circle";
    if (type === "danger") icon = "alert-circle";
    if (type === "warning") icon = "alert-triangle";
    toast.innerHTML = `<i data-lucide="${icon}"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);
    if (typeof lucide !== "undefined") lucide.createIcons();
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // Skeletons por tipo de view — mostra "sombra" do conteúdo enquanto carrega
  _skeletons: {
    table: (rows = 6) => `
      <div class="skel skel-title"></div>
      <div class="skel-card" style="padding:0;">
        ${Array.from({ length: rows }).map(() => `
          <div class="skel-row">
            <div class="skel skel-text" style="flex:2;"></div>
            <div class="skel skel-text" style="flex:1;"></div>
            <div class="skel skel-text" style="flex:1;"></div>
            <div class="skel skel-text" style="flex:1;"></div>
            <div class="skel skel-text" style="width:80px;"></div>
          </div>`).join("")}
      </div>`,
    dashboard: () => `
      <div class="skel skel-title" style="width:30%;"></div>
      <div class="skel-stat-grid">
        ${Array.from({ length: 4 }).map(() => `
          <div class="skel-card"><div class="skel skel-text" style="width:60%;height:36px;"></div><div class="skel skel-text" style="width:80%;margin-top:8px;"></div></div>
        `).join("")}
      </div>
      <div class="skel-card" style="height:200px;"></div>`,
    kanban: () => `
      <div class="skel skel-title" style="width:35%;"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        ${Array.from({ length: 3 }).map(() => `
          <div class="skel-card" style="min-height:300px;">
            <div class="skel skel-text" style="width:60%;height:16px;"></div>
            ${Array.from({ length: 3 }).map(() => `<div class="skel skel-card" style="margin-top:12px;height:70px;border:none;"></div>`).join("")}
          </div>`).join("")}
      </div>`,
    cards: () => `
      <div class="skel skel-title" style="width:25%;"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
        ${Array.from({ length: 6 }).map(() => `<div class="skel-card" style="height:160px;"></div>`).join("")}
      </div>`,
    profile: () => `
      <div class="skel skel-title" style="width:20%;"></div>
      <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;">
        <div class="skel-card" style="height:240px;"></div>
        <div class="skel-card" style="height:240px;"></div>
      </div>`,
  },

  showLoading: (variant = "table") => {
    const skel = UI._skeletons[variant] || UI._skeletons.table;
    document.getElementById("view-content").innerHTML = `<div class="fade-in" style="padding:4px 0;">${skel()}</div>`;
  },

  debounce: (fn, delay = 200) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // Modal de confirmação reutilizável. Retorna Promise<boolean>.
  confirm: ({
    title = "Confirmar ação",
    message = "Tem certeza?",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    danger = false,
  } = {}) => {
    return new Promise((resolve) => {
      const root = document.getElementById("modal-root");
      const html = `
        <div class="modal-overlay" id="ui-confirm-modal">
          <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="background:${danger ? "rgba(239,68,68,.1)" : "rgba(245,158,11,.1)"};color:${danger ? "var(--danger-color)" : "var(--warning-color)"};padding:10px;border-radius:10px;flex-shrink:0;">
                  <i data-lucide="${danger ? "alert-triangle" : "help-circle"}" style="width:20px;"></i>
                </div>
                <h3 style="margin:0;">${escapeHtml(title)}</h3>
              </div>
              <button class="modal-close" type="button" id="ui-confirm-close"><i data-lucide="x"></i></button>
            </div>
            <p style="color:var(--text-secondary);font-size:14px;line-height:1.5;margin:8px 0 24px;">${escapeHtml(message)}</p>
            <div style="display:flex;justify-content:flex-end;gap:10px;">
              <button type="button" class="btn-primary" id="ui-confirm-cancel" style="background:#e2e8f0;color:#475569;">${escapeHtml(cancelText)}</button>
              <button type="button" class="${danger ? "btn-danger" : "btn-primary"}" id="ui-confirm-ok">${escapeHtml(confirmText)}</button>
            </div>
          </div>
        </div>`;
      root.insertAdjacentHTML("beforeend", html);
      if (typeof lucide !== "undefined") lucide.createIcons();

      const modal = document.getElementById("ui-confirm-modal");
      const finish = (result) => {
        modal?.remove();
        resolve(result);
      };
      document.getElementById("ui-confirm-ok").addEventListener("click", () => finish(true));
      document.getElementById("ui-confirm-cancel").addEventListener("click", () => finish(false));
      document.getElementById("ui-confirm-close").addEventListener("click", () => finish(false));
      modal.addEventListener("click", (e) => { if (e.target === modal) finish(false); });
    });
  },
};

const App = {
  // Cada módulo em modules/X.js adiciona aqui sua interface (App.modules.X = {...}).
  modules: {},

  // Cada chamada de handleRoute incrementa o token; respostas async com token
  // antigo são descartadas (evita race condition ao trocar de tela rapidamente).
  _routeToken: 0,

  init: async () => {
    await Auth.init();
    window.addEventListener("hashchange", () => App.handleRoute());
  },

  showAuthView: () => {
    document.getElementById("app-container").classList.add("hidden");
    document.getElementById("auth-container").classList.remove("hidden");
    App.loadLogin();
  },

  showAppView: () => {
    document.getElementById("auth-container").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    App.darkMode.init();
    App.renderSidebarProfile();
    App.handleRoute();
    App.notifications.init();
  },

  handleRoute: async () => {
    const route = window.location.hash || "#dashboard";
    const viewContent = document.getElementById("view-content");
    const token = ++App._routeToken;
    App.updateActiveNavLink(route);
    const skeletonVariants = {
      "#dashboard": "dashboard",
      "#workflow": "kanban",
      "#mapa-salas": "cards",
      "#perfil": "profile",
    };
    UI.showLoading(skeletonVariants[route] || "table");
    App.closeMobileMenu();

    const searchInput = document.getElementById("global-search");
    if (searchInput) searchInput.value = "";

    const dispatch = async () => {
      switch (route) {
        case "#dashboard":      return App.modules.dashboard.init();
        case "#workflow":       return App.modules.workflow.init();
        case "#salas":          return App.modules.salas.init();
        case "#usuarios":       return App.modules.usuarios.init();
        case "#equipamentos":   return App.modules.equipamentos.init();
        case "#movimentacoes":  return App.modules.movimentacoes.init();
        case "#rastreio":       return App.modules.rastreio.init();
        case "#mapa-salas":     return App.modules.mapaSalas.init();
        case "#perfil":         return App.modules.perfil.init();
        case "#auditoria":      return App.modules.auditoria.init();
        default:
          viewContent.innerHTML =
            '<div style="text-align:center;padding:40px;"><h2>Erro 404</h2><p style="color:var(--text-secondary)">A tela procurada não existe.</p></div>';
      }
    };

    await dispatch();
    if (token !== App._routeToken) return;
  },

  toggleMobileMenu: () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebar-backdrop").classList.toggle("active");
  },

  closeMobileMenu: () => {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-backdrop").classList.remove("active");
  },

  /* ── AUTH / PROFILE ────────────────────────────────────────────── */

  loadLogin: () => {
    document.getElementById("auth-container").innerHTML = Views.auth.login();
    document
      .getElementById("login-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button");
        const orig = btn.textContent;
        btn.innerHTML =
          '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i>';
        if (typeof lucide !== "undefined") lucide.createIcons();
        btn.disabled = true;
        await Auth.signIn(
          document.getElementById("login-email").value,
          document.getElementById("login-password").value,
        );
        if (document.getElementById("login-form")) {
          btn.textContent = orig;
          btn.disabled = false;
        }
      });
    document.getElementById("go-to-register").addEventListener("click", (e) => {
      e.preventDefault();
      App.loadRegister();
    });
  },

  loadRegister: () => {
    document.getElementById("auth-container").innerHTML = Views.auth.register();
    document
      .getElementById("register-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button");
        const orig = btn.textContent;
        btn.innerHTML =
          '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i>';
        if (typeof lucide !== "undefined") lucide.createIcons();
        btn.disabled = true;
        await Auth.signUp(
          document.getElementById("register-name").value,
          document.getElementById("register-email").value,
          document.getElementById("register-password").value,
        );
        if (document.getElementById("register-form")) {
          btn.textContent = orig;
          btn.disabled = false;
        }
      });
    document.getElementById("go-to-login").addEventListener("click", (e) => {
      e.preventDefault();
      App.loadLogin();
    });
  },

  renderSidebarProfile: () => {
    const container = document.getElementById("sidebar-profile");
    if (container && Auth.user) {
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(Auth.user.full_name || "U")}&background=0c4a6e&color=fff`;
      const roleLabels = { admin: "Admin", tecnico: "Técnico", usuario: "Usuário" };
      const roleLabel = roleLabels[Auth.user.role] || "Usuário";
      container.innerHTML = `
                <a href="#perfil" class="sidebar-profile-link" title="Ver meu perfil">
                    <img src="${avatarUrl}" alt="Avatar" class="avatar">
                    <div class="profile-info">
                        <div class="name" title="${escapeHtml(Auth.user.full_name)}">${escapeHtml(Auth.user.full_name)}</div>
                        <div class="role">${escapeHtml(roleLabel)}</div>
                    </div>
                </a>
                <button class="btn-logout" onclick="Auth.signOut()" title="Sair do Sistema">
                    <i data-lucide="log-out"></i>
                </button>`;
      if (typeof lucide !== "undefined") lucide.createIcons();
      const liAuditoria = document.getElementById("li-auditoria");
      if (liAuditoria) liAuditoria.style.display = Auth.user.role === "admin" ? "" : "none";
    }
  },

  updateActiveNavLink: (route) => {
    document
      .querySelectorAll(".sidebar-menu ul li")
      .forEach((li) => li.classList.remove("active"));
    const link = document.querySelector(`.sidebar-menu a[href="${route}"]`);
    if (link) link.parentElement.classList.add("active");
  },
};

// App.init() é chamado em index.html DEPOIS que todos os módulos foram carregados.
