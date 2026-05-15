// modules/notifications.js — Painel de notificações (badge + lista de atividades recentes).
App.notifications = {
  _data: [],

  _relativeTime: (date) => {
    const diff = Date.now() - date;
    const min = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (min < 1) return "Agora mesmo";
    if (min < 60) return `${min} min atrás`;
    if (h < 24) return `${h}h atrás`;
    if (d < 7) return `${d}d atrás`;
    return date.toLocaleDateString("pt-BR");
  },

  init: async () => {
    const [{ data: movements }, { data: equipment }, { data: profiles }] =
      await Promise.all([
        supabaseClient
          .from("asset_movements")
          .select(
            "id, equipment(name), moved_by, moved_at, destination_room:destination_room_id(name), origin_room:origin_room_id(name), asset_number, serial_number, received_by",
          )
          .is("deleted_at", null)
          .order("moved_at", { ascending: false })
          .limit(15),
        supabaseClient
          .from("equipment")
          .select("id, name, created_by, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseClient.from("profiles").select("id, full_name").is("deleted_at", null),
      ]);

    const profileMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p]),
    );
    const lastSeen = localStorage.getItem("notif_last_seen")
      ? new Date(localStorage.getItem("notif_last_seen"))
      : null;

    const items = [
      ...(movements || []).map((m) => ({
        id: "mov_" + m.id,
        refId: m.id,
        type: "movement",
        actor: profileMap[m.moved_by]?.full_name || "Alguém",
        text: `registrou movimentação de <strong>${escapeHtml(m.equipment?.name || "equipamento")}</strong> para <strong>${escapeHtml(m.destination_room?.name || "—")}</strong>`,
        date: new Date(m.moved_at),
        data: m,
      })),
      ...(equipment || []).map((e) => ({
        id: "eq_" + e.id,
        refId: e.id,
        type: "equipment",
        actor: profileMap[e.created_by]?.full_name || "Alguém",
        text: `cadastrou o equipamento <strong>${escapeHtml(e.name)}</strong>`,
        date: new Date(e.created_at),
        data: e,
      })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 25);

    App.notifications._data = items;

    const unseen = lastSeen
      ? items.filter((i) => i.date > lastSeen).length
      : items.length;
    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = unseen > 9 ? "9+" : String(unseen);
      badge.style.display = unseen > 0 ? "" : "none";
    }
  },

  toggle: () => {
    const panel = document.getElementById("notifications-panel");
    if (!panel) return;
    panel.classList.contains("hidden")
      ? App.notifications.open()
      : App.notifications.close();
  },

  open: () => {
    const panel = document.getElementById("notifications-panel");
    const backdrop = document.getElementById("notifications-backdrop");
    if (!panel) return;

    localStorage.setItem("notif_last_seen", new Date().toISOString());
    const badge = document.getElementById("notif-badge");
    if (badge) badge.style.display = "none";

    panel.innerHTML = Views.app.notificationsPanel(App.notifications._data);
    panel.classList.remove("hidden");
    if (backdrop) backdrop.classList.add("active");
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  close: () => {
    const panel = document.getElementById("notifications-panel");
    const backdrop = document.getElementById("notifications-backdrop");
    if (panel) panel.classList.add("hidden");
    if (backdrop) backdrop.classList.remove("active");
  },

  showDetail: (id) => {
    App.notifications.close();
    const item = App.notifications._data.find((i) => i.id === id);
    if (!item) return;
    document.getElementById("modal-root").innerHTML =
      Views.app.notificationDetailModal(item);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },
};
