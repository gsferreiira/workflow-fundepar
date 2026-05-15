// modules/rastreio.js — Lista a localização atual de cada patrimônio físico.
App.modules.rastreio = {
  _data: [],
  _filteredData: [],

  init: async () => {
    const [
      { data: movements, error },
      { data: rooms },
      { data: profilesList },
    ] = await Promise.all([
      supabaseClient
        .from("asset_movements")
        .select(
          "equipment_id, equipment(name,categoria,status,observacao), asset_number, serial_number, received_by, moved_at, destination_room_id, moved_by",
        )
        .is("deleted_at", null)
        .order("moved_at", { ascending: false }),
      supabaseClient.from("rooms").select("id, name").is("deleted_at", null),
      supabaseClient.from("profiles").select("id, full_name").is("deleted_at", null),
    ]);

    if (error) {
      UI.showToast(error.message, "danger");
      return;
    }

    const roomMap = Object.fromEntries((rooms || []).map((r) => [r.id, r]));
    const profileMap = Object.fromEntries(
      (profilesList || []).map((p) => [p.id, p]),
    );

    // Deduplica por patrimônio físico (asset_number), não por tipo.
    // Mesma lógica do mapa de salas — movimentos já vêm ordenados DESC.
    // Só inclui itens que têm uma localização atual (destination_room_id).
    const seen = new Set();
    const data = [];
    (movements || []).forEach((m) => {
      const key = m.asset_number
        ? `pat_${m.asset_number}`
        : m.serial_number
          ? `eq_${m.equipment_id}_ser_${m.serial_number}`
          : `eq_${m.equipment_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (!m.destination_room_id) return;
      data.push({
        equipment_id: m.equipment_id,
        equipment: m.equipment,
        categoria: m.equipment?.categoria || null,
        status: m.equipment?.status || null,
        observacao: m.equipment?.observacao || null,
        asset_number: m.asset_number || null,
        serial_number: m.serial_number || null,
        received_by: m.received_by || null,
        moved_at: m.moved_at || null,
        destination_room_id: m.destination_room_id,
        moved_by: m.moved_by || null,
        room: roomMap[m.destination_room_id] || null,
        profile: profileMap[m.moved_by] || null,
      });
    });

    App.modules.rastreio._data = data;
    App.modules.rastreio._filteredData = data;

    const uniqueRooms = Object.values(
      Object.fromEntries(
        data
          .filter((d) => d.room)
          .map((d) => [d.destination_room_id, d.room]),
      ),
    ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const categorias = [
      ...new Set(data.filter((d) => d.categoria).map((d) => d.categoria)),
    ].sort();

    document.getElementById("view-content").innerHTML = Views.app.rastreio(
      data,
      uniqueRooms,
      categorias,
    );
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  applyFilters: () => {
    const term = (document.getElementById("rastreio-search")?.value || "")
      .toLowerCase()
      .trim();
    const roomId = document.getElementById("rastreio-filter-room")?.value || "";
    const categoria =
      document.getElementById("rastreio-filter-cat")?.value || "";
    const status =
      document.getElementById("rastreio-filter-status")?.value || "";
    const sort = document.getElementById("rastreio-sort")?.value || "az";

    let filtered = App.modules.rastreio._data.filter((d) => {
      if (roomId && d.destination_room_id !== roomId) return false;
      if (categoria && (d.categoria || "") !== categoria) return false;
      if (status && (d.status || "") !== status) return false;
      if (term) {
        const hay = [
          d.equipment?.name || "",
          d.asset_number || "",
          d.serial_number || "",
          d.categoria || "",
          d.received_by || "",
          d.observacao || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    if (sort === "az")
      filtered.sort((a, b) =>
        (a.equipment?.name || "").localeCompare(b.equipment?.name || "", "pt-BR"),
      );
    else if (sort === "za")
      filtered.sort((a, b) =>
        (b.equipment?.name || "").localeCompare(a.equipment?.name || "", "pt-BR"),
      );
    else if (sort === "pat")
      filtered.sort((a, b) =>
        (a.asset_number || "zzz").localeCompare(b.asset_number || "zzz", "pt-BR", {
          numeric: true,
        }),
      );
    else if (sort === "sala")
      filtered.sort((a, b) =>
        (a.room?.name || "zzz").localeCompare(b.room?.name || "zzz", "pt-BR"),
      );
    else if (sort === "cat")
      filtered.sort((a, b) =>
        (a.categoria || "zzz").localeCompare(b.categoria || "zzz", "pt-BR"),
      );

    App.modules.rastreio._filteredData = filtered;

    const tbody = document.getElementById("rastreio-tbody");
    if (tbody) {
      tbody.innerHTML = Views.app._rastreioRows(filtered);
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
    const countEl = document.getElementById("rastreio-result-count");
    if (countEl)
      countEl.textContent = `${filtered.length} equipamento${filtered.length !== 1 ? "s" : ""}`;
  },

  exportExcel: () => {
    if (typeof XLSX === "undefined") {
      UI.showToast("Biblioteca não carregada.", "danger");
      return;
    }
    const rows = App.modules.rastreio._filteredData;
    if (rows.length === 0) {
      UI.showToast("Nenhum equipamento para exportar.", "warning");
      return;
    }

    const wsData = [
      [
        "Equipamento", "Categoria", "Status", "Nº Patrimônio", "Nº Série",
        "Localização Atual", "Com quem está", "Última Movimentação", "Observação",
      ],
      ...rows.map((d) => [
        d.equipment?.name || "—",
        d.categoria || "—",
        d.status || "—",
        formatAssetNumber(d.asset_number) || "—",
        d.serial_number || "—",
        d.room?.name || "Não localizado",
        d.received_by || "—",
        d.moved_at ? new Date(d.moved_at).toLocaleString("pt-BR") : "Nunca movimentado",
        d.observacao || "—",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
      { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rastreio");
    XLSX.writeFile(wb, `rastreio_${new Date().toISOString().slice(0, 10)}.xlsx`);
    UI.showToast("Arquivo exportado!", "success");
  },

  showHistory: async (equipmentId, equipmentName) => {
    const { data: movements, error } = await supabaseClient
      .from("asset_movements")
      .select(
        "*, origin_room:origin_room_id(name), destination_room:destination_room_id(name), profile:moved_by(full_name)",
      )
      .eq("equipment_id", equipmentId)
      .is("deleted_at", null)
      .order("moved_at", { ascending: false });

    if (error) {
      UI.showToast("Erro ao carregar histórico.", "danger");
      return;
    }
    document.getElementById("modal-root").innerHTML =
      Views.app.rastreioHistoryModal(equipmentName, movements || []);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  filter: (term) => {
    App.modules.rastreio.applyFilters();
  },
};
