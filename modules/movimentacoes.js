// modules/movimentacoes.js — Registro e histórico de movimentações de patrimônio.
// Paginação e filtros agora rodam no servidor (Supabase) — viabiliza escala
// para dezenas de milhares de registros sem travar o navegador.
App.modules.movimentacoes = {
  _equipment: [],
  _rooms: [],
  _lastData: [],       // página atualmente carregada (não é tudo!)
  _filteredData: [],   // alias de _lastData (mantido para compat com globalSearch)
  _importRows: [],
  _page: 1,
  _pageSize: 25,
  _total: 0,           // total de registros que atendem os filtros (server-side count)
  _searchTerm: "",     // termo da barra de busca global (aplicado no servidor)

  // Lê os filtros atuais da UI e devolve um objeto pronto para query.
  _readFilters: () => ({
    dateFrom: document.getElementById("filter-date-from")?.value || "",
    dateTo: document.getElementById("filter-date-to")?.value || "",
    equipmentId: document.getElementById("filter-equipment")?.value || "",
    originId: document.getElementById("filter-origin")?.value || "",
    destId: document.getElementById("filter-dest")?.value || "",
    responsible: document.getElementById("filter-responsible")?.value || "",
    assetDigits: (document.getElementById("filter-asset")?.value || "").replace(/\D/g, ""),
    search: App.modules.movimentacoes._searchTerm.trim(),
  }),

  // Monta a query do Supabase aplicando os filtros e o range da página.
  _buildQuery: (filters, { page, pageSize, count = false }) => {
    let q = supabaseClient
      .from("asset_movements")
      .select("*, equipment(name)", count ? { count: "exact" } : {})
      .is("deleted_at", null);

    if (filters.dateFrom) q = q.gte("moved_at", new Date(filters.dateFrom + "T00:00:00").toISOString());
    if (filters.dateTo) q = q.lte("moved_at", new Date(filters.dateTo + "T23:59:59").toISOString());
    if (filters.equipmentId) q = q.eq("equipment_id", filters.equipmentId);
    if (filters.originId) q = q.eq("origin_room_id", filters.originId);
    if (filters.destId) q = q.eq("destination_room_id", filters.destId);
    if (filters.responsible) q = q.eq("moved_by", filters.responsible);
    if (filters.assetDigits) q = q.ilike("asset_number", `%${filters.assetDigits}%`);
    // Busca textual: serial, asset, received_by (campos simples no próprio asset_movements)
    if (filters.search) {
      const term = filters.search.replace(/[%_]/g, "");
      q = q.or(
        `serial_number.ilike.%${term}%,asset_number.ilike.%${term}%,received_by.ilike.%${term}%`,
      );
    }

    q = q.order("moved_at", { ascending: false });
    const from = (page - 1) * pageSize;
    q = q.range(from, from + pageSize - 1);
    return q;
  },

  // Busca uma página específica do servidor e re-renderiza a tabela + paginação.
  fetchPage: async (page) => {
    const mod = App.modules.movimentacoes;
    mod._page = page;
    const filters = mod._readFilters();
    const { data, count, error } = await mod._buildQuery(filters, {
      page,
      pageSize: mod._pageSize,
      count: true,
    });
    if (error) {
      UI.showToast("Erro ao carregar movimentações: " + error.message, "danger");
      return;
    }

    // Hidrata origin/destination/profiles usando o Store (cache)
    const [rooms, profilesList] = await Promise.all([Store.rooms(), Store.profiles()]);
    const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const profileMap = Object.fromEntries(profilesList.map((p) => [p.id, p]));
    const enriched = (data || []).map((m) => ({
      ...m,
      origin: roomMap[m.origin_room_id] || null,
      destination: roomMap[m.destination_room_id] || null,
      profiles: profileMap[m.moved_by] || null,
      editedBy: profileMap[m.edited_by] || null,
    }));

    mod._lastData = enriched;
    mod._filteredData = enriched;
    mod._total = count || 0;
    mod.renderPage();
  },

  renderPage: () => {
    const mod = App.modules.movimentacoes;
    const tbody = document.getElementById("movimentacoes-tbody");
    if (tbody) {
      tbody.innerHTML = Views.app.movimentacoesRows(mod._lastData);
      if (typeof lucide !== "undefined") lucide.createIcons();
    }

    const pag = document.getElementById("mov-pagination");
    if (pag) {
      pag.innerHTML = Views.app.movimentacoesPagination(
        mod._page,
        mod._total,
        mod._pageSize,
      );
      if (typeof lucide !== "undefined") lucide.createIcons();
    }

    const countEl = document.getElementById("filter-result-count");
    if (countEl)
      countEl.textContent = `${mod._total} resultado${mod._total !== 1 ? "s" : ""}`;
  },

  prevPage: () => {
    if (App.modules.movimentacoes._page > 1) {
      App.modules.movimentacoes.fetchPage(App.modules.movimentacoes._page - 1);
      window.scrollTo(0, 0);
    }
  },

  nextPage: () => {
    const mod = App.modules.movimentacoes;
    if (mod._page < Math.ceil(mod._total / mod._pageSize)) {
      mod.fetchPage(mod._page + 1);
      window.scrollTo(0, 0);
    }
  },

  openImportPicker: () => {
    const input = document.getElementById("import-file-input");
    if (input) {
      input.value = "";
      input.click();
    }
  },

  handleImportFile: async (input) => {
    if (Auth.user?.role !== "admin") {
      UI.showToast("Acesso restrito a administradores.", "danger");
      return;
    }
    const file = input.files[0];
    if (!file) return;

    const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_IMPORT_SIZE) {
      UI.showToast(
        "Arquivo muito grande (máximo 5 MB). Divida em planilhas menores.",
        "warning",
      );
      return;
    }

    if (typeof XLSX === "undefined") {
      UI.showToast("Biblioteca não carregada.", "danger");
      return;
    }

    const [equipment, rooms] = await Promise.all([Store.equipment(), Store.rooms()]);

    const normalize = (s) => (s || "").toString().trim().toLowerCase();
    const eqByName = Object.fromEntries(
      (equipment || []).map((e) => [normalize(e.name), e]),
    );
    const roomByName = Object.fromEntries(
      (rooms || []).map((r) => [normalize(r.name), r]),
    );

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const s = val.toString().trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
      const d = new Date(s);
      return isNaN(d) ? null : d;
    };

    const rows = raw.map((row) => {
      const equipmentName = (row["Equipamento"] || "").toString().trim();
      const serialNumber = (row["Nº Série"] || "").toString().trim() || null;
      const assetNumber = (row["Nº Patrimônio"] || "").toString().trim() || null;
      const originName = (row["Origem"] || "").toString().trim();
      const destName = (row["Destino"] || "").toString().trim();
      const receivedBy = (row["Recebedor"] || "").toString().trim() || null;
      const dateRaw = row["Data / Hora"];
      const movedAt = parseDate(dateRaw);

      const eq = eqByName[normalize(equipmentName)];
      const origin = originName ? roomByName[normalize(originName)] : null;
      const dest = destName ? roomByName[normalize(destName)] : null;

      const errors = [];
      const warnings = [];

      if (!equipmentName) errors.push("Equipamento não informado");
      else if (!eq) errors.push("Equipamento não encontrado no cadastro");
      if (!destName) errors.push("Destino não informado");
      else if (!dest) errors.push("Sala de destino não encontrada no cadastro");
      if (originName && !origin)
        warnings.push("Sala de origem não encontrada — ficará em branco");
      if (!movedAt)
        warnings.push("Data inválida ou ausente — será usada a data/hora atual");

      const status =
        errors.length > 0 ? "error" : warnings.length > 0 ? "warn" : "ok";

      return {
        equipmentName,
        serialNumber,
        assetNumber,
        originName,
        destName,
        receivedBy,
        equipmentId: eq?.id || null,
        originId: origin?.id || null,
        destId: dest?.id || null,
        movedAt,
        movedAtDisplay: movedAt ? movedAt.toLocaleString("pt-BR") : null,
        status,
        errors,
        warnings,
      };
    });

    App.modules.movimentacoes._importRows = rows;
    document.getElementById("modal-root").innerHTML =
      Views.app.importPreviewModal(rows);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  confirmImport: async () => {
    const rows = App.modules.movimentacoes._importRows.filter(
      (r) => r.status !== "error",
    );
    if (rows.length === 0) {
      UI.showToast("Nenhuma linha válida para importar.", "warning");
      return;
    }

    const btn = document.querySelector(
      "#import-preview-modal .btn-primary:last-child",
    );
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Importando...";
    }

    const inserts = rows.map((r) => ({
      equipment_id: r.equipmentId,
      serial_number: r.serialNumber || null,
      asset_number: r.assetNumber || null,
      origin_room_id: r.originId || null,
      destination_room_id: r.destId,
      moved_by: Auth.user.id,
      received_by: r.receivedBy || null,
      moved_at: r.movedAt ? r.movedAt.toISOString() : new Date().toISOString(),
    }));

    const { error } = await supabaseClient
      .from("asset_movements")
      .insert(inserts);

    if (error) {
      UI.showToast("Erro ao importar: " + error.message, "danger");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Confirmar Importação";
      }
      return;
    }

    Audit.log("import", "asset_movements", null, { count: rows.length });
    document.getElementById("import-preview-modal").remove();
    UI.showToast(
      `${rows.length} movimentaç${rows.length !== 1 ? "ões importadas" : "ão importada"} com sucesso!`,
      "success",
    );
    App.modules.movimentacoes.init();
  },

  // Aplica filtros: dispara uma nova busca paginada no servidor.
  applyFilters: () => {
    App.modules.movimentacoes.fetchPage(1);
  },

  clearFilters: () => {
    [
      "filter-date-from", "filter-date-to", "filter-equipment",
      "filter-origin", "filter-dest", "filter-responsible", "filter-asset",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    App.modules.movimentacoes._searchTerm = "";
    App.modules.movimentacoes.applyFilters();
  },

  exportExcel: async () => {
    if (typeof XLSX === "undefined") {
      UI.showToast("Biblioteca de exportação não carregada.", "danger");
      return;
    }
    const mod = App.modules.movimentacoes;
    // Como agora paginamos no servidor, precisamos buscar TODAS as linhas
    // filtradas (não só a página atual) para gerar o Excel completo.
    UI.showToast("Preparando exportação...", "success");
    const filters = mod._readFilters();
    const EXPORT_PAGE_SIZE = 1000;
    let page = 1;
    let all = [];
    while (true) {
      const { data, error } = await mod._buildQuery(filters, {
        page,
        pageSize: EXPORT_PAGE_SIZE,
      });
      if (error) {
        UI.showToast("Erro ao exportar: " + error.message, "danger");
        return;
      }
      all = all.concat(data || []);
      if (!data || data.length < EXPORT_PAGE_SIZE) break;
      page++;
      if (all.length >= 20000) break; // safety guard
    }
    if (all.length === 0) {
      UI.showToast("Nenhuma movimentação para exportar.", "warning");
      return;
    }

    const [rooms, profilesList] = await Promise.all([Store.rooms(), Store.profiles()]);
    const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const profileMap = Object.fromEntries(profilesList.map((p) => [p.id, p]));

    const wsData = [
      [
        "Equipamento", "Nº Série", "Nº Patrimônio", "Origem", "Destino",
        "Responsável", "Com quem está", "Data / Hora",
      ],
      ...all.map((m) => [
        m.equipment?.name || "—",
        m.serial_number || "—",
        formatAssetNumber(m.asset_number) || "—",
        roomMap[m.origin_room_id]?.name || "—",
        roomMap[m.destination_room_id]?.name || "—",
        profileMap[m.moved_by]?.full_name || "—",
        m.received_by || "—",
        new Date(m.moved_at).toLocaleString("pt-BR"),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
      { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");

    const fileName = `movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    UI.showToast(`${all.length} linha${all.length !== 1 ? "s" : ""} exportada${all.length !== 1 ? "s" : ""}!`, "success");
  },

  init: async () => {
    const mod = App.modules.movimentacoes;
    mod._searchTerm = "";
    mod._page = 1;

    // Lista de equipamentos / salas / usuários para os dropdowns do filtro vem do Store.
    const [equipment, rooms, profilesList] = await Promise.all([
      Store.equipment(),
      Store.rooms(),
      Store.profiles(),
    ]);

    // Renderiza o esqueleto da view (filtros + tabela vazia) primeiro.
    document.getElementById("view-content").innerHTML =
      Views.app.movimentacoes([], equipment, rooms, profilesList);
    if (typeof lucide !== "undefined") lucide.createIcons();

    // Busca a primeira página com filtros padrão.
    await mod.fetchPage(1);
  },

  showCreateModal: async (
    prefillAsset = null,
    prefillOriginId = null,
    prefillOriginName = null,
  ) => {
    const [equipment, rooms] = await Promise.all([Store.equipment(), Store.rooms()]);
    App.modules.movimentacoes._equipment = equipment;
    App.modules.movimentacoes._rooms = rooms;
    document.getElementById("modal-root").innerHTML =
      Views.app.movimentacaoModal(
        equipment,
        rooms,
        prefillAsset,
        prefillOriginId,
        prefillOriginName,
      );
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  lookupAndFillOrigin: async (rawValue) => {
    const digits = (rawValue || "").replace(/\D/g, "");
    if (digits.length !== 12) return;
    const assetNumber = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`;

    const originIdInput = document.getElementById("mov-origin-id");
    const originTextInput = document.querySelector(
      '#wrap-mov-origin input[type="text"]',
    );
    if (!originIdInput || originIdInput.value) return;

    const { data } = await supabaseClient
      .from("asset_movements")
      .select("destination_room_id, destination_room:destination_room_id(id, name)")
      .eq("asset_number", assetNumber)
      .is("deleted_at", null)
      .order("moved_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].destination_room) {
      const room = data[0].destination_room;
      originIdInput.value = room.id;
      if (originTextInput) originTextInput.value = room.name;
      UI.showToast(`Origem preenchida automaticamente: ${room.name}`, "success");
    }
  },

  showEditModal: async (movId) => {
    let movement = App.modules.movimentacoes._lastData.find((m) => m.id === movId);
    if (!movement) {
      // Pode estar em outra página — busca direto no banco
      const { data, error } = await supabaseClient
        .from("asset_movements")
        .select("*, equipment(name)")
        .eq("id", movId)
        .is("deleted_at", null)
        .single();
      if (error || !data) {
        UI.showToast("Movimentação não encontrada.", "danger");
        return;
      }
      const [rooms] = await Promise.all([Store.rooms()]);
      const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
      movement = {
        ...data,
        origin: roomMap[data.origin_room_id] || null,
        destination: roomMap[data.destination_room_id] || null,
      };
    }
    const rooms = await Store.rooms();
    App.modules.movimentacoes._rooms = rooms;
    document.getElementById("modal-root").innerHTML =
      Views.app.movimentacaoEditModal(movement, rooms);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  update: async (e, movId) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
    if (typeof lucide !== "undefined") lucide.createIcons();

    const originRoomId = document.getElementById("edit-mov-origin-id").value;
    const destRoomId = document.getElementById("edit-mov-destination-id").value;
    const editReason = document.getElementById("edit-mov-reason").value.trim();

    const originRoom = App.modules.movimentacoes._rooms.find((r) => r.id === originRoomId);
    const destRoom = App.modules.movimentacoes._rooms.find((r) => r.id === destRoomId);

    if (!originRoom) {
      UI.showToast("Selecione a sala de origem.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }
    if (!destRoom) {
      UI.showToast("Selecione a sala de destino.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }
    if (originRoomId === destRoomId) {
      UI.showToast("A sala de origem e destino não podem ser iguais.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }
    if (!editReason) {
      UI.showToast("A justificativa é obrigatória.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }

    const movedAtVal = document.getElementById("edit-mov-date").value;
    const rawEditAsset = document.getElementById("edit-mov-asset").value.trim();
    const editDigits = rawEditAsset.replace(/\D/g, "");
    const editAsset =
      editDigits.length === 12
        ? `${editDigits.slice(0, 3)}.${editDigits.slice(3, 6)}.${editDigits.slice(6, 9)}.${editDigits.slice(9, 12)}`
        : rawEditAsset || null;

    const { error } = await supabaseClient
      .from("asset_movements")
      .update({
        serial_number: document.getElementById("edit-mov-serial").value.trim() || null,
        asset_number: editAsset,
        origin_room_id: originRoom.id,
        destination_room_id: destRoom.id,
        received_by: document.getElementById("edit-mov-received-by").value.trim() || null,
        moved_at: movedAtVal ? new Date(movedAtVal).toISOString() : undefined,
        is_edited: true,
        edited_by: Auth.user.id,
        edited_at: new Date().toISOString(),
        edit_reason: editReason,
      })
      .eq("id", movId);

    if (error) {
      UI.showToast("Erro ao atualizar: " + error.message, "danger");
      btn.disabled = false; btn.textContent = orig; return;
    }

    const { error: editLogError } = await supabaseClient
      .from("movement_edits")
      .insert([
        {
          movement_id: movId,
          edited_by: Auth.user.id,
          edited_at: new Date().toISOString(),
          edit_reason: editReason,
        },
      ]);
    if (editLogError) {
      console.warn("Histórico de edição não registrado:", editLogError.message);
    }

    Audit.updated("asset_movements", movId, { reason: editReason });
    document.getElementById("movimentacao-edit-modal").remove();
    UI.showToast("Movimentação atualizada!", "success");
    App.modules.movimentacoes.init();
  },

  showEditInfo: async (movId) => {
    const [{ data: logs, error }, { data: profilesList }] = await Promise.all([
      supabaseClient
        .from("movement_edits")
        .select("*")
        .eq("movement_id", movId)
        .order("edited_at", { ascending: false }),
      supabaseClient.from("profiles").select("id, full_name"),
    ]);
    if (error) {
      UI.showToast("Erro ao carregar histórico.", "danger");
      return;
    }
    const profileMap = Object.fromEntries(
      (profilesList || []).map((p) => [p.id, p]),
    );
    const enrichedLogs = (logs || []).map((log) => ({
      ...log,
      editor_name: profileMap[log.edited_by]?.full_name || "—",
    }));
    document.getElementById("modal-root").innerHTML =
      Views.app.movimentacaoEditInfoModal(enrichedLogs);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  delete: async (movId) => {
    const ok = await UI.confirm({
      title: "Excluir movimentação",
      message: "Tem certeza que deseja excluir esta movimentação? O registro será marcado como excluído mas pode ser restaurado por um admin.",
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabaseClient
      .from("asset_movements")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", movId)
      .is("deleted_at", null);
    if (error) {
      UI.showToast("Erro ao excluir: " + error.message, "danger");
      return;
    }
    Audit.deleted("asset_movements", movId);
    UI.showToast("Movimentação excluída.", "success");
    App.modules.movimentacoes.init();
  },

  /* ── MOVIMENTAÇÃO EM LOTE ──────────────────────────────────────── */
  _loteItems: [],
  _loteUid: 0,
  _loteEquipment: [],
  _loteRooms: [],
  // Estado salvo antes de abrir o scanner (restaurado ao concluir)
  _loteOriginId: "",
  _loteOriginName: "",
  _loteDestId: "",
  _loteDestName: "",
  _loteReceivedByVal: "",
  _loteItemStatusVal: "",
  _loteComentarioVal: "",

  showCreateLoteModal: async () => {
    const mod = App.modules.movimentacoes;
    const [equipment, rooms] = await Promise.all([Store.equipment(), Store.rooms()]);
    mod._loteEquipment = equipment;
    mod._loteRooms = rooms;
    mod._loteItems = [];
    mod._loteUid = 0;
    mod._loteOriginId = "";
    mod._loteOriginName = "";
    mod._loteDestId = "";
    mod._loteDestName = "";
    mod._loteReceivedByVal = "";
    mod._loteItemStatusVal = "";
    mod._loteComentarioVal = "";
    document.getElementById("modal-root").innerHTML =
      Views.app.movimentacaoLoteModal(equipment, rooms);
    if (typeof lucide !== "undefined") lucide.createIcons();
    mod.addLoteItem();
  },

  _saveLoteAllState: () => {
    const mod = App.modules.movimentacoes;
    mod._saveLoteFormState();
    mod._loteOriginId = document.getElementById("lote-origin-id")?.value || "";
    mod._loteOriginName =
      document.querySelector("#wrap-lote-origin input[type='text']")?.value || "";
    mod._loteDestId = document.getElementById("lote-dest-id")?.value || "";
    mod._loteDestName =
      document.querySelector("#wrap-lote-dest input[type='text']")?.value || "";
    mod._loteReceivedByVal =
      document.getElementById("lote-received-by")?.value || "";
    mod._loteItemStatusVal =
      document.getElementById("lote-item-status")?.value || "";
    mod._loteComentarioVal =
      document.getElementById("lote-comentario")?.value || "";
  },

  openScannerForLote: () => {
    App.modules.movimentacoes._saveLoteAllState();
    App.scanner.openForLote();
  },

  restoreLoteModal: () => {
    const mod = App.modules.movimentacoes;
    document.getElementById("modal-root").innerHTML =
      Views.app.movimentacaoLoteModal(mod._loteEquipment, mod._loteRooms, {
        originId: mod._loteOriginId,
        originName: mod._loteOriginName,
        destId: mod._loteDestId,
        destName: mod._loteDestName,
        receivedBy: mod._loteReceivedByVal,
        itemStatus: mod._loteItemStatusVal,
        comentario: mod._loteComentarioVal,
      });
    if (typeof lucide !== "undefined") lucide.createIcons();
    mod.renderLoteItems();
  },

  _loteItemRowHTML: (item) => {
    const mod = App.modules.movimentacoes;
    const eqList = mod._loteEquipment
      .map(
        (e) =>
          `<div class="autocomplete-item" data-label="${escapeHtml(e.name)}" onpointerdown="event.preventDefault();Autocomplete.pick('wrap-lote-equip-${item.uid}','${escapeHtml(e.id)}','${escapeHtml(e.name)}','lote-equip-id-${item.uid}')">${escapeHtml(e.name)}</div>`,
      )
      .join("");
    return `
      <div class="lote-item-row" id="lote-row-${item.uid}">
        <div style="flex:2;min-width:0;">
          <input type="hidden" id="lote-equip-id-${item.uid}" value="${escapeHtml(item.equipmentId || "")}">
          <div class="autocomplete-wrapper" id="wrap-lote-equip-${item.uid}">
            <input type="text" id="lote-equip-name-${item.uid}" class="form-control"
                   value="${escapeHtml(item.equipmentName || "")}"
                   placeholder="Equipamento *" autocomplete="off"
                   onfocus="Autocomplete.show('wrap-lote-equip-${item.uid}')"
                   onblur="Autocomplete.hide('wrap-lote-equip-${item.uid}')"
                   oninput="Autocomplete.filter('wrap-lote-equip-${item.uid}')">
            <div class="autocomplete-list" id="wrap-lote-equip-${item.uid}-list">${eqList}</div>
          </div>
        </div>
        <div style="flex:1;min-width:0;">
          <input type="text" id="lote-asset-${item.uid}" class="form-control"
                 value="${escapeHtml(item.assetNumber || "")}"
                 placeholder="Nº Patrimônio" oninput="maskAssetNumber(event)">
        </div>
        <div style="flex:1;min-width:0;">
          <input type="text" id="lote-serial-${item.uid}" class="form-control"
                 value="${escapeHtml(item.serialNumber || "")}"
                 placeholder="Nº Série">
        </div>
        <button type="button"
                onclick="App.modules.movimentacoes.removeLoteItem(${item.uid})"
                style="background:none;border:none;color:var(--danger-color);cursor:pointer;padding:6px 4px;flex-shrink:0;"
                title="Remover item">
          <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
        </button>
      </div>`;
  },

  _saveLoteFormState: () => {
    App.modules.movimentacoes._loteItems.forEach((item) => {
      item.equipmentId = document.getElementById(`lote-equip-id-${item.uid}`)?.value || "";
      item.equipmentName = document.getElementById(`lote-equip-name-${item.uid}`)?.value || "";
      item.assetNumber = document.getElementById(`lote-asset-${item.uid}`)?.value || "";
      item.serialNumber = document.getElementById(`lote-serial-${item.uid}`)?.value || "";
    });
  },

  renderLoteItems: () => {
    const mod = App.modules.movimentacoes;
    const container = document.getElementById("lote-items-list");
    if (!container) return;
    container.innerHTML = mod._loteItems
      .map((item) => mod._loteItemRowHTML(item))
      .join("");
    if (typeof lucide !== "undefined") lucide.createIcons();
    const n = mod._loteItems.length;
    const badge = document.getElementById("lote-count-badge");
    if (badge) badge.textContent = `${n} item${n !== 1 ? "s" : ""}`;
    const btn = document.getElementById("lote-submit-btn");
    if (btn) {
      btn.disabled = n === 0;
      btn.textContent =
        n > 0
          ? `Registrar ${n} movimentaç${n !== 1 ? "ões" : "ão"}`
          : "Adicione ao menos 1 item";
    }
  },

  addLoteItem: () => {
    const mod = App.modules.movimentacoes;
    mod._saveLoteFormState();
    mod._loteUid++;
    mod._loteItems.push({
      uid: mod._loteUid,
      equipmentId: "",
      equipmentName: "",
      assetNumber: "",
      serialNumber: "",
    });
    mod.renderLoteItems();
  },

  removeLoteItem: (uid) => {
    const mod = App.modules.movimentacoes;
    mod._saveLoteFormState();
    mod._loteItems = mod._loteItems.filter((item) => item.uid !== uid);
    mod.renderLoteItems();
  },

  createLote: async (e) => {
    e.preventDefault();
    const mod = App.modules.movimentacoes;
    mod._saveLoteFormState();

    const originRoomId = document.getElementById("lote-origin-id")?.value || "";
    const destRoomId = document.getElementById("lote-dest-id")?.value || "";
    const receivedBy =
      document.getElementById("lote-received-by")?.value?.trim() || null;
    const itemStatus =
      document.getElementById("lote-item-status")?.value || null;
    const comentario =
      document.getElementById("lote-comentario")?.value?.trim() || null;

    if (!originRoomId) {
      UI.showToast("Selecione a sala de origem.", "warning");
      return;
    }
    if (!destRoomId) {
      UI.showToast("Selecione a sala de destino.", "warning");
      return;
    }
    if (originRoomId === destRoomId) {
      UI.showToast("Origem e destino não podem ser iguais.", "warning");
      return;
    }
    if (mod._loteItems.some((item) => !item.equipmentId)) {
      UI.showToast(
        "Preencha ou remova os itens sem equipamento selecionado.",
        "warning",
      );
      return;
    }
    if (mod._loteItems.length === 0) {
      UI.showToast("Adicione ao menos um equipamento.", "warning");
      return;
    }

    const originRoom = mod._loteRooms.find((r) => r.id === originRoomId);
    const destRoom = mod._loteRooms.find((r) => r.id === destRoomId);
    if (!originRoom || !destRoom) {
      UI.showToast("Sala não encontrada.", "warning");
      return;
    }

    const btn = document.getElementById("lote-submit-btn");
    const origText = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Registrando...';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }

    const movedAt = new Date().toISOString();
    const inserts = mod._loteItems.map((item) => {
      const digits = (item.assetNumber || "").replace(/\D/g, "");
      const assetNumber =
        digits.length === 12
          ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`
          : item.assetNumber || null;
      return {
        equipment_id: item.equipmentId,
        serial_number: item.serialNumber || null,
        asset_number: assetNumber,
        origin_room_id: originRoom.id,
        destination_room_id: destRoom.id,
        moved_by: Auth.user.id,
        received_by: receivedBy,
        moved_at: movedAt,
        item_status: itemStatus || null,
        comentario: comentario,
      };
    });

    const { error } = await supabaseClient.from("asset_movements").insert(inserts);
    if (error) {
      UI.showToast("Erro ao registrar: " + error.message, "danger");
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
      }
      return;
    }

    const locUpserts = inserts
      .filter((r) => r.asset_number)
      .map((r) => ({
        equipment_id: r.equipment_id,
        asset_number: r.asset_number,
        serial_number: r.serial_number,
        current_room_id: destRoom.id,
        moved_by: Auth.user.id,
        received_by: receivedBy,
        moved_at: movedAt,
      }));
    if (locUpserts.length > 0) {
      const { error: locError } = await supabaseClient
        .from("equipment_locations")
        .upsert(locUpserts, { onConflict: "asset_number" });
      if (locError) console.warn("Localização não atualizada:", locError.message);
    }

    if (itemStatus) {
      const uniqueEqIds = [...new Set(mod._loteItems.map((i) => i.equipmentId))];
      for (const eqId of uniqueEqIds) {
        await supabaseClient
          .from("equipment")
          .update({ status: itemStatus })
          .eq("id", eqId);
      }
    }

    Audit.log("batch_movement", "asset_movements", null, {
      count: inserts.length,
      from: originRoom.name,
      to: destRoom.name,
    });

    document.getElementById("movimentacao-lote-modal")?.remove();
    UI.showToast(
      `${inserts.length} movimentaç${inserts.length !== 1 ? "ões registradas" : "ão registrada"} com sucesso!`,
      "success",
    );
    App.modules.movimentacoes.init();
    App.notifications.init();
  },

  fillEquipmentData: (name) => {
    const eq = App.modules.movimentacoes._equipment.find((e) => e.name === name);
    document.getElementById("mov-equipment-id").value = eq ? eq.id : "";
  },

  create: async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Registrando...';
    if (typeof lucide !== "undefined") lucide.createIcons();

    const equipmentId = document.getElementById("mov-equipment-id").value;
    const originRoomId = document.getElementById("mov-origin-id").value;
    const destRoomId = document.getElementById("mov-destination-id").value;

    if (!equipmentId) {
      UI.showToast("Selecione um equipamento da lista.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }
    if (!originRoomId) {
      UI.showToast("Selecione a sala de origem.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }
    if (!destRoomId) {
      UI.showToast("Selecione a sala de destino.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }

    const originRoom = App.modules.movimentacoes._rooms.find((r) => r.id === originRoomId);
    const destRoom = App.modules.movimentacoes._rooms.find((r) => r.id === destRoomId);

    if (!originRoom || !destRoom) {
      UI.showToast("Sala não encontrada. Tente novamente.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }
    if (originRoomId === destRoomId) {
      UI.showToast("A sala de origem e destino não podem ser iguais.", "warning");
      btn.disabled = false; btn.textContent = orig; return;
    }

    const serialNumber = document.getElementById("mov-serial").value || null;
    const rawAsset = document.getElementById("mov-asset-number").value || "";
    const assetDigits = rawAsset.replace(/\D/g, "");
    const assetNumber =
      assetDigits.length === 12
        ? `${assetDigits.slice(0, 3)}.${assetDigits.slice(3, 6)}.${assetDigits.slice(6, 9)}.${assetDigits.slice(9, 12)}`
        : rawAsset || null;
    const receivedBy = document.getElementById("mov-received-by").value.trim() || null;
    const movedAt = new Date().toISOString();

    if (assetNumber) {
      const { data: lastMov } = await supabaseClient
        .from("asset_movements")
        .select("destination_room_id")
        .eq("asset_number", assetNumber)
        .is("deleted_at", null)
        .order("moved_at", { ascending: false })
        .limit(1);

      if (lastMov && lastMov.length > 0 && lastMov[0].destination_room_id === destRoomId) {
        UI.showToast("Este patrimônio já está na sala de destino selecionada.", "warning");
        btn.disabled = false; btn.textContent = orig; return;
      }
    }

    const itemStatus = document.getElementById("mov-item-status").value || null;
    const comentario = document.getElementById("mov-comentario").value.trim() || null;

    const { data: insertedMov, error } = await supabaseClient.from("asset_movements").insert([
      {
        equipment_id: equipmentId,
        serial_number: serialNumber,
        asset_number: assetNumber,
        origin_room_id: originRoom.id,
        destination_room_id: destRoom.id,
        moved_by: Auth.user.id,
        received_by: receivedBy,
        moved_at: movedAt,
        item_status: itemStatus,
        comentario: comentario,
      },
    ]).select("id").single();

    if (!error && itemStatus) {
      await supabaseClient
        .from("equipment")
        .update({ status: itemStatus })
        .eq("id", equipmentId);
    }

    if (error) {
      UI.showToast("Erro ao registrar: " + error.message, "danger");
      btn.disabled = false; btn.textContent = orig; return;
    }

    // Atualiza localização atual do patrimônio físico individual.
    // Conflito por asset_number (cada peça física é única) — NÃO por equipment_id,
    // que representa apenas o TIPO de equipamento e é compartilhado entre múltiplas peças.
    if (assetNumber) {
      const { error: locError } = await supabaseClient
        .from("equipment_locations")
        .upsert(
          {
            equipment_id: equipmentId,
            asset_number: assetNumber,
            serial_number: serialNumber,
            current_room_id: destRoom.id,
            moved_by: Auth.user.id,
            received_by: receivedBy,
            moved_at: movedAt,
          },
          { onConflict: "asset_number" },
        );
      if (locError) {
        console.warn("Localização atual não atualizada:", locError.message);
      }
    }

    Audit.created("asset_movements", insertedMov?.id, {
      equipment_id: equipmentId,
      asset_number: assetNumber,
      from: originRoom.name,
      to: destRoom.name,
    });
    document.getElementById("movimentacao-modal").remove();
    UI.showToast("Movimentação registrada!", "success");
    App.modules.movimentacoes.init();
    App.notifications.init();
  },
};
