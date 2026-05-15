// modules/salas.js — Cadastro de salas/locais.
App.modules.salas = {
  _salas: [],

  init: async () => {
    const { data: salas, error } = await supabaseClient
      .from("rooms")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    if (error) {
      UI.showToast(error.message, "danger");
      return;
    }
    App.modules.salas._salas = salas || [];
    document.getElementById("view-content").innerHTML = Views.app.salas(
      App.modules.salas._salas,
    );
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  applySort: (order) => {
    const salas = [...App.modules.salas._salas];
    if (order === "numero") {
      salas.sort((a, b) => {
        if (!a.room_number && !b.room_number) return 0;
        if (!a.room_number) return 1;
        if (!b.room_number) return -1;
        return a.room_number.localeCompare(b.room_number, "pt-BR", {
          numeric: true,
        });
      });
    } else {
      salas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    document.getElementById("salas-tbody").innerHTML =
      Views.app._salasRows(salas);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  showCreateModal: () => {
    document.getElementById("modal-root").innerHTML = Views.app.roomModal();
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  createRoom: async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Processando...';
    if (typeof lucide !== "undefined") lucide.createIcons();
    const name = document.getElementById("room-name").value;
    const { data: inserted, error } = await supabaseClient.from("rooms").insert([
      {
        name,
        description: document.getElementById("room-description").value,
        room_number: document.getElementById("room-number").value || null,
        coordinator:
          document.getElementById("room-coordinator").value || null,
      },
    ]).select("id").single();
    if (error) {
      UI.showToast("Erro ao criar sala: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
    } else {
      Audit.created("rooms", inserted?.id, { name });
      document.getElementById("room-modal").remove();
      UI.showToast("Sala cadastrada!", "success");
      Store.invalidate("rooms", "roomsFull");
      App.modules.salas.init();
    }
  },

  editRoom: async (salaId) => {
    const { data: sala, error } = await supabaseClient
      .from("rooms")
      .select("*")
      .eq("id", salaId)
      .is("deleted_at", null)
      .single();
    if (error) {
      UI.showToast("Erro ao carregar sala.", "danger");
      return;
    }
    document.getElementById("modal-root").innerHTML =
      Views.app.salaEditModal(sala);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  updateRoom: async (e, salaId) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
    if (typeof lucide !== "undefined") lucide.createIcons();
    const updates = {
      name: document.getElementById("edit-room-name").value,
      description: document.getElementById("edit-room-description").value,
      room_number: document.getElementById("edit-room-number").value || null,
      coordinator: document.getElementById("edit-room-coordinator").value || null,
    };
    const { error } = await supabaseClient
      .from("rooms")
      .update(updates)
      .eq("id", salaId);
    if (error) {
      UI.showToast("Erro ao atualizar: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
    } else {
      Audit.updated("rooms", salaId, updates);
      document.getElementById("sala-edit-modal").remove();
      UI.showToast("Sala atualizada!", "success");
      Store.invalidate("rooms", "roomsFull");
      App.modules.salas.init();
    }
  },

  deleteRoom: async (salaId) => {
    const sala = App.modules.salas._salas.find((s) => s.id === salaId);
    const ok = await UI.confirm({
      title: "Excluir sala",
      message: `Tem certeza que deseja excluir a sala${sala ? ` "${sala.name}"` : ""}? Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabaseClient
      .from("rooms")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", salaId)
      .is("deleted_at", null);
    if (error) {
      UI.showToast("Erro ao excluir: " + error.message, "danger");
      return;
    }
    Audit.deleted("rooms", salaId, { name: sala?.name });
    UI.showToast("Sala excluída.", "success");
    Store.invalidate("rooms", "roomsFull");
    App.modules.salas.init();
  },
};
