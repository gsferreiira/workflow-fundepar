// modules/equipamentos.js — Cadastro de equipamentos (tipos / catálogo).
App.modules.equipamentos = {
  _list: [],

  init: async () => {
    const { data: equipamentos, error } = await supabaseClient
      .from("equipment")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    if (error) {
      UI.showToast(error.message, "danger");
      return;
    }
    App.modules.equipamentos._list = equipamentos || [];
    document.getElementById("view-content").innerHTML =
      Views.app.equipamentos(equipamentos || []);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  showCreateModal: () => {
    document.getElementById("modal-root").innerHTML =
      Views.app.equipamentoModal();
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  applyFilters: () => {
    const term = (document.getElementById("equip-search")?.value || "")
      .toLowerCase()
      .trim();
    const cat = document.getElementById("equip-filter-cat")?.value || "";
    const status = document.getElementById("equip-filter-status")?.value || "";
    const filtered = App.modules.equipamentos._list.filter((eq) => {
      if (cat && (eq.categoria || "") !== cat) return false;
      if (status && (eq.status || "") !== status) return false;
      if (term) {
        const hay = (
          (eq.name || "") +
          " " +
          (eq.categoria || "") +
          " " +
          (eq.observacao || "")
        ).toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    const tbody = document.getElementById("equipamentos-tbody");
    if (tbody) tbody.innerHTML = Views.app._equipamentosRows(filtered);
    const cnt = document.getElementById("equip-result-count");
    if (cnt)
      cnt.textContent = `${filtered.length} equipamento${filtered.length !== 1 ? "s" : ""}`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  create: async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
    if (typeof lucide !== "undefined") lucide.createIcons();
    const name = document.getElementById("equip-name").value.trim();
    const { data: inserted, error } = await supabaseClient.from("equipment").insert([
      {
        name,
        categoria:
          document.getElementById("equip-categoria").value.trim() || null,
        status: document.getElementById("equip-status").value || "bom",
        observacao:
          document.getElementById("equip-observacao").value.trim() || null,
        created_by: Auth.user.id,
      },
    ]).select("id").single();
    if (error) {
      UI.showToast("Erro ao cadastrar: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
    } else {
      Audit.created("equipment", inserted?.id, { name });
      document.getElementById("equipamento-modal").remove();
      UI.showToast("Equipamento cadastrado!", "success");
      Store.invalidate("equipment");
      App.modules.equipamentos.init();
      App.notifications.init();
    }
  },

  editEquipamento: async (id) => {
    const { data: eq, error } = await supabaseClient
      .from("equipment")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      UI.showToast("Erro ao carregar equipamento.", "danger");
      return;
    }
    document.getElementById("modal-root").innerHTML =
      Views.app.equipamentoEditModal(eq);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  updateEquipamento: async (e, id) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
    if (typeof lucide !== "undefined") lucide.createIcons();
    const updates = {
      name: document.getElementById("edit-equip-name").value.trim(),
      categoria: document.getElementById("edit-equip-categoria").value.trim() || null,
      status: document.getElementById("edit-equip-status").value || "bom",
      observacao: document.getElementById("edit-equip-observacao").value.trim() || null,
    };
    const { error } = await supabaseClient
      .from("equipment")
      .update(updates)
      .eq("id", id);
    if (error) {
      UI.showToast("Erro ao atualizar: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
    } else {
      Audit.updated("equipment", id, updates);
      document.getElementById("equipamento-edit-modal").remove();
      UI.showToast("Equipamento atualizado!", "success");
      Store.invalidate("equipment");
      App.modules.equipamentos.init();
    }
  },

  deleteEquipamento: async (id) => {
    const eq = App.modules.equipamentos._list.find((e) => e.id === id);
    const ok = await UI.confirm({
      title: "Excluir equipamento",
      message: `Tem certeza que deseja excluir o equipamento${eq ? ` "${eq.name}"` : ""}? Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabaseClient
      .from("equipment")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) {
      UI.showToast("Erro ao excluir: " + error.message, "danger");
      return;
    }
    Audit.deleted("equipment", id, { name: eq?.name });
    UI.showToast("Equipamento excluído.", "success");
    Store.invalidate("equipment");
    App.modules.equipamentos.init();
  },
};
