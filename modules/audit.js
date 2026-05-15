// modules/audit.js — Registro centralizado de ações para auditoria.
//
// Uso:
//   Audit.log('create', 'rooms', sala.id, { name: sala.name });
//   Audit.log('update', 'equipment', eq.id, { before: oldData, after: newData });
//   Audit.log('delete', 'asset_movements', movId);
//
// Logs são gravados em audit_logs. Falhas são silenciosas (apenas console.warn)
// para nunca bloquear a operação principal do usuário.
const Audit = {
  log: async (action, tableName, recordId, details = null) => {
    if (!Auth.user) return;
    try {
      const { error } = await supabaseClient.from("audit_logs").insert([
        {
          actor_id: Auth.user.id,
          actor_name: Auth.user.full_name || Auth.user.email || null,
          table_name: tableName,
          record_id: recordId != null ? String(recordId) : null,
          action: action,
          details: details,
        },
      ]);
      if (error) {
        console.warn(`Audit.log falhou (${action} ${tableName}):`, error.message);
      }
    } catch (err) {
      console.warn(`Audit.log exceção (${action} ${tableName}):`, err);
    }
  },

  // Helpers semânticos opcionais
  created: (tableName, recordId, details) => Audit.log("create", tableName, recordId, details),
  updated: (tableName, recordId, details) => Audit.log("update", tableName, recordId, details),
  deleted: (tableName, recordId, details) => Audit.log("delete", tableName, recordId, details),
  restored: (tableName, recordId, details) => Audit.log("restore", tableName, recordId, details),
};

/* ── TELA DE AUDITORIA (admin-only) ───────────────────────────── */
App.modules.auditoria = {
  _page: 1,
  _pageSize: 50,
  _total: 0,
  _lastData: [],

  _readFilters: () => ({
    actorId: document.getElementById("audit-filter-actor")?.value || "",
    action: document.getElementById("audit-filter-action")?.value || "",
    table: document.getElementById("audit-filter-table")?.value || "",
    dateFrom: document.getElementById("audit-filter-date-from")?.value || "",
    dateTo: document.getElementById("audit-filter-date-to")?.value || "",
  }),

  _buildQuery: (filters, { page, pageSize, count = false }) => {
    let q = supabaseClient
      .from("audit_logs")
      .select("*", count ? { count: "exact" } : {});
    if (filters.actorId) q = q.eq("actor_id", filters.actorId);
    if (filters.action) q = q.eq("action", filters.action);
    if (filters.table) q = q.eq("table_name", filters.table);
    if (filters.dateFrom)
      q = q.gte("created_at", new Date(filters.dateFrom + "T00:00:00").toISOString());
    if (filters.dateTo)
      q = q.lte("created_at", new Date(filters.dateTo + "T23:59:59").toISOString());
    q = q.order("created_at", { ascending: false });
    const from = (page - 1) * pageSize;
    return q.range(from, from + pageSize - 1);
  },

  fetchPage: async (page) => {
    const mod = App.modules.auditoria;
    mod._page = page;
    const filters = mod._readFilters();
    const { data, count, error } = await mod._buildQuery(filters, {
      page,
      pageSize: mod._pageSize,
      count: true,
    });
    if (error) {
      UI.showToast("Erro ao carregar logs: " + error.message, "danger");
      return;
    }
    mod._lastData = data || [];
    mod._total = count || 0;
    mod.renderPage();
  },

  renderPage: () => {
    const mod = App.modules.auditoria;
    const tbody = document.getElementById("audit-tbody");
    if (tbody) {
      tbody.innerHTML = Views.app.auditoriaRows(mod._lastData);
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
    const pag = document.getElementById("audit-pagination");
    if (pag) {
      pag.innerHTML = Views.app.auditoriaPagination(mod._page, mod._total, mod._pageSize);
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
    const countEl = document.getElementById("audit-result-count");
    if (countEl)
      countEl.textContent = `${mod._total} registro${mod._total !== 1 ? "s" : ""}`;
  },

  prevPage: () => {
    if (App.modules.auditoria._page > 1) {
      App.modules.auditoria.fetchPage(App.modules.auditoria._page - 1);
      window.scrollTo(0, 0);
    }
  },

  nextPage: () => {
    const mod = App.modules.auditoria;
    if (mod._page < Math.ceil(mod._total / mod._pageSize)) {
      mod.fetchPage(mod._page + 1);
      window.scrollTo(0, 0);
    }
  },

  applyFilters: () => App.modules.auditoria.fetchPage(1),

  clearFilters: () => {
    ["audit-filter-actor", "audit-filter-action", "audit-filter-table",
     "audit-filter-date-from", "audit-filter-date-to"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    App.modules.auditoria.fetchPage(1);
  },

  init: async () => {
    if (Auth.user?.role !== "admin") {
      document.getElementById("view-content").innerHTML = `
        <div style="text-align:center;padding:80px 20px;">
          <i data-lucide="lock" style="width:48px;height:48px;color:var(--text-secondary);display:block;margin:0 auto 16px;opacity:.4;"></i>
          <h3 style="margin:0 0 8px;">Acesso restrito</h3>
          <p style="color:var(--text-secondary);margin:0;">Esta seção é visível apenas para administradores.</p>
        </div>`;
      if (typeof lucide !== "undefined") lucide.createIcons();
      return;
    }
    const profiles = await Store.profiles();
    document.getElementById("view-content").innerHTML =
      Views.app.auditoria(profiles);
    if (typeof lucide !== "undefined") lucide.createIcons();
    await App.modules.auditoria.fetchPage(1);
  },
};
