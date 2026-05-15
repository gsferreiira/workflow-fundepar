// modules/mapaSalas.js — Visão por sala dos equipamentos alocados.
App.modules.mapaSalas = {
  _rooms: [],
  _filteredRooms: [],

  init: async () => {
    const [{ data: rooms, error }, { data: movements }] = await Promise.all([
      supabaseClient.from("rooms").select("*").is("deleted_at", null).order("name"),
      supabaseClient
        .from("asset_movements")
        .select(
          "equipment_id, equipment(name), asset_number, serial_number, received_by, moved_at, destination_room_id",
        )
        .is("deleted_at", null)
        .order("moved_at", { ascending: false }),
    ]);

    if (error) {
      UI.showToast(error.message, "danger");
      return;
    }

    // Deduplica por patrimônio individual (asset_number), não por tipo de equipamento.
    // Chave: asset_number se existir, senão equipment_id+serial_number, senão equipment_id.
    // Movimentos já vêm ordenados DESC por moved_at, então o primeiro encontrado = mais recente.
    const seen = new Set();
    const locationsByRoom = {};
    (movements || []).forEach((m) => {
      const key = m.asset_number
        ? `pat_${m.asset_number}`
        : m.serial_number
          ? `eq_${m.equipment_id}_ser_${m.serial_number}`
          : `eq_${m.equipment_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const rid = m.destination_room_id;
      if (!rid) return;
      if (!locationsByRoom[rid]) locationsByRoom[rid] = [];
      locationsByRoom[rid].push({
        name: m.equipment?.name || "—",
        asset_number: m.asset_number || null,
        serial_number: m.serial_number || null,
        received_by: m.received_by || null,
        moved_at: m.moved_at || null,
      });
    });

    const roomsWithItems = (rooms || []).map((r) => ({
      ...r,
      items: locationsByRoom[r.id] || [],
    }));

    App.modules.mapaSalas._rooms = roomsWithItems;
    App.modules.mapaSalas._filteredRooms = roomsWithItems;
    document.getElementById("view-content").innerHTML =
      Views.app.mapaSalas(roomsWithItems);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  applyFilters: () => {
    const normalizeSearch = (value) =>
      (value || "")
        .toString()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
    const term = normalizeSearch(
      document.getElementById("mapa-salas-search")?.value || "",
    ).trim();

    const filtered = App.modules.mapaSalas._rooms.filter((room) => {
      if (!term) return true;
      const people = [
        room.coordinator,
        ...(room.items || []).map((item) => item.received_by),
      ]
        .filter(Boolean)
        .join(" ");
      return [room.name, room.room_number, people].some((value) =>
        normalizeSearch(value).includes(term),
      );
    });

    App.modules.mapaSalas._filteredRooms = filtered;
    document
      .querySelectorAll("#mapa-salas-grid .room-map-card")
      .forEach((card) => {
        card.style.display =
          !term || normalizeSearch(card.dataset.search).includes(term)
            ? ""
            : "none";
      });

    const emptyEl = document.getElementById("mapa-salas-empty-filter");
    if (emptyEl) {
      emptyEl.style.display = term && filtered.length === 0 ? "" : "none";
    }
    const emptyStateEl = document.getElementById("mapa-salas-empty-state");
    if (emptyStateEl) emptyStateEl.style.display = term ? "none" : "";

    const countEl = document.getElementById("mapa-salas-result-count");
    if (countEl) {
      countEl.textContent = `${filtered.length} sala${filtered.length !== 1 ? "s" : ""}`;
    }

    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  showRoomDetail: (roomId) => {
    const room = App.modules.mapaSalas._rooms.find((r) => r.id === roomId);
    if (!room) return;
    document.getElementById("modal-root").innerHTML =
      Views.app.salaDetailModal(room);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  exportExcel: (roomId) => {
    if (typeof XLSX === "undefined") {
      UI.showToast("Biblioteca não carregada.", "danger");
      return;
    }
    const room = App.modules.mapaSalas._rooms.find((r) => r.id === roomId);
    if (!room) return;

    const wsData = [
      ["Equipamento", "Nº Patrimônio", "Nº Série", "Recebedor", "Última Movimentação"],
      ...room.items.map((item) => [
        item.name || "—",
        formatAssetNumber(item.asset_number) || "—",
        item.serial_number || "—",
        item.received_by || "—",
        item.moved_at ? new Date(item.moved_at).toLocaleString("pt-BR") : "—",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    const sheetName = room.name.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const safeName = room.name.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 40);
    XLSX.writeFile(
      wb,
      `sala_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    UI.showToast(
      `Exportado: ${room.items.length} equipamento${room.items.length !== 1 ? "s" : ""}`,
      "success",
    );
  },
};
