// modules/workflow.js — Kanban de chamados (tickets).
App.modules.workflow = {
  _tickets: [],
  _isDragging: false,

  init: async () => {
    const { data: tickets, error } = await supabaseClient
      .from("tickets")
      .select("*, rooms(name), profiles:requester_id(full_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      UI.showToast(error.message, "danger");
      return;
    }
    App.modules.workflow._tickets = tickets;
    document.getElementById("view-content").innerHTML =
      Views.app.workflow(tickets);
    if (typeof lucide !== "undefined") lucide.createIcons();
    App.modules.workflow.switchTab("aberto");
  },

  showCreateModal: async () => {
    const rooms = await Store.rooms();
    document.getElementById("modal-root").innerHTML = Views.app.ticketModal(rooms);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  createTicket: async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Processando...';
    if (typeof lucide !== "undefined") lucide.createIcons();
    const title = document.getElementById("ticket-title").value.trim();
    const { data: inserted, error } = await supabaseClient.from("tickets").insert([
      {
        title,
        description: document.getElementById("ticket-desc").value.trim(),
        room_id: document.getElementById("ticket-room").value,
        priority: document.getElementById("ticket-priority").value,
        requester_id: Auth.user.id,
        status: "aberto",
      },
    ]).select("id").single();
    if (error) {
      UI.showToast("Erro ao criar chamado: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
    } else {
      Audit.created("tickets", inserted?.id, { title });
      document.getElementById("ticket-modal").remove();
      UI.showToast("Chamado aberto com sucesso!", "success");
      App.modules.workflow.init();
    }
  },

  showDetailModal: (ticketId) => {
    if (App.modules.workflow._isDragging) return;
    const ticket = App.modules.workflow._tickets.find(
      (t) => t.id === ticketId,
    );
    if (!ticket) return;
    document.getElementById("modal-root").innerHTML =
      Views.app.ticketDetailModal(ticket);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  moveTicket: async (ticketId, newStatus) => {
    const { error } = await supabaseClient
      .from("tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);
    if (error) {
      UI.showToast("Erro ao mover chamado.", "danger");
      return;
    }
    Audit.updated("tickets", ticketId, { status: newStatus });
    document.getElementById("ticket-detail-modal")?.remove();
    UI.showToast("Status atualizado!", "success");
    App.modules.workflow.init();
  },

  deleteTicket: async (ticketId) => {
    const ok = await UI.confirm({
      title: "Excluir chamado",
      message: "Tem certeza que deseja excluir este chamado? Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;

    const btn = document.getElementById("btn-delete-ticket");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Excluindo...';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
    const { data: deleted, error } = await supabaseClient
      .from("tickets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ticketId)
      .is("deleted_at", null)
      .select("id");
    if (error) {
      UI.showToast("Erro ao excluir: " + error.message, "danger");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="trash-2"></i> Excluir Chamado';
        if (typeof lucide !== "undefined") lucide.createIcons();
      }
      return;
    }
    if (!deleted || deleted.length === 0) {
      UI.showToast("Sem permissão para excluir este chamado.", "danger");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="trash-2"></i> Excluir Chamado';
        if (typeof lucide !== "undefined") lucide.createIcons();
      }
      return;
    }
    Audit.deleted("tickets", ticketId);
    document.getElementById("ticket-detail-modal")?.remove();
    UI.showToast("Chamado excluído.", "success");
    App.modules.workflow.init();
  },

  switchTab: (status) => {
    document
      .querySelectorAll(".kanban-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".kanban-column")
      .forEach((c) => c.classList.remove("active"));
    document
      .querySelector(`.kanban-tab[data-tab="${status}"]`)
      ?.classList.add("active");
    document
      .querySelector(`.kanban-column[data-status="${status}"]`)
      ?.classList.add("active");
  },

  dragStart: (event) => {
    App.modules.workflow._isDragging = true;
    event.dataTransfer.setData(
      "ticketId",
      event.currentTarget.dataset.ticketId,
    );
  },
  dragEnd: () => {
    setTimeout(() => {
      App.modules.workflow._isDragging = false;
    }, 100);
  },

  drop: async (event) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("ticketId");
    const newStatus = event.currentTarget.dataset.status;
    if (!ticketId || !newStatus) return;
    // Evita request desnecessário ao soltar na mesma coluna de origem
    const ticket = App.modules.workflow._tickets.find((t) => t.id === ticketId);
    if (ticket && ticket.status === newStatus) return;
    const { error } = await supabaseClient
      .from("tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);
    if (error) {
      UI.showToast("Falha ao atualizar status.", "danger");
    } else {
      Audit.updated("tickets", ticketId, { status: newStatus, via: "drag" });
      App.modules.workflow.init();
    }
  },
};
