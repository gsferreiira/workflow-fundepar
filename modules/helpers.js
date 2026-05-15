// modules/helpers.js — Autocomplete custom, dark mode, busca global e
// versões debounced dos filtros (depende dos demais módulos já estarem carregados).

/* ── AUTOCOMPLETE ──────────────────────────────────────────────────── */
const Autocomplete = {
  show: (id) => {
    const list = document.getElementById(id + "-list");
    if (!list) return;
    list
      .querySelectorAll(".autocomplete-item")
      .forEach((el) => el.classList.remove("hidden"));
    list.classList.add("open");
  },
  hide: (id) => {
    setTimeout(() => {
      const list = document.getElementById(id + "-list");
      if (list) list.classList.remove("open");
    }, 200);
  },
  filter: (id) => {
    const wrapper = document.getElementById(id);
    const list = document.getElementById(id + "-list");
    if (!wrapper || !list) return;
    const q = (wrapper.querySelector('input[type="text"]')?.value || "")
      .toLowerCase()
      .trim();
    list.classList.add("open");
    let visible = 0;
    list.querySelectorAll(".autocomplete-item").forEach((el) => {
      const match = !q || el.dataset.label.toLowerCase().includes(q);
      el.classList.toggle("hidden", !match);
      if (match) visible++;
    });
    let empty = list.querySelector(".autocomplete-empty");
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "autocomplete-empty";
      empty.textContent = "Nenhum resultado.";
      list.appendChild(empty);
    }
    empty.style.display = visible === 0 ? "" : "none";
  },
  pick: (id, value, label, hiddenId) => {
    const wrapper = document.getElementById(id);
    if (wrapper) {
      const inp = wrapper.querySelector('input[type="text"]');
      if (inp) inp.value = label;
    }
    if (hiddenId) {
      const h = document.getElementById(hiddenId);
      if (h) h.value = value;
    }
    const list = document.getElementById(id + "-list");
    if (list) list.classList.remove("open");
  },
};

/* ── DARK MODE ─────────────────────────────────────────────────────── */
App.darkMode = {
  init: () => {
    if (localStorage.getItem("dark_mode") === "1") {
      document.body.classList.add("dark");
      App.darkMode._icon(true);
    }
  },
  toggle: () => {
    const dark = document.body.classList.toggle("dark");
    localStorage.setItem("dark_mode", dark ? "1" : "0");
    App.darkMode._icon(dark);
  },
  _icon: (dark) => {
    const btn = document.getElementById("dark-mode-btn");
    if (!btn) return;
    btn.innerHTML = `<i data-lucide="${dark ? "sun" : "moon"}"></i>`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  },
};

/* ── GLOBAL SEARCH ─────────────────────────────────────────────────── */
// Filtra a tabela da tela atual conforme o usuário digita na barra de busca do topbar.
App.globalSearch = (term) => {
  const route = window.location.hash || "#dashboard";
  const q = term.toLowerCase().trim();

  if (route === "#movimentacoes") {
    // Movimentações usa paginação server-side: empurra o termo de busca para
    // o módulo e refeta a primeira página com os filtros atuais.
    App.modules.movimentacoes._searchTerm = q;
    App.modules.movimentacoes.fetchPage(1);
  } else if (route === "#rastreio") {
    const roomId = document.getElementById("rastreio-filter-room")?.value || "";
    const filtered = App.modules.rastreio._data.filter((d) => {
      if (roomId && d.destination_room_id !== roomId) return false;
      if (q) {
        const hay = (
          (d.equipment?.name || "") +
          " " +
          (d.asset_number || "") +
          " " +
          (d.serial_number || "")
        ).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    App.modules.rastreio._filteredData = filtered;
    const tbody = document.getElementById("rastreio-tbody");
    if (tbody) {
      tbody.innerHTML = Views.app._rastreioRows(filtered);
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
    const countEl = document.getElementById("rastreio-result-count");
    if (countEl)
      countEl.textContent = `${filtered.length} equipamento${filtered.length !== 1 ? "s" : ""}`;
  } else if (route === "#equipamentos") {
    document
      .querySelectorAll("#equipamentos-tbody tr[data-search]")
      .forEach((row) => {
        row.style.display = !q || row.dataset.search.includes(q) ? "" : "none";
      });
  } else if (route === "#salas") {
    document.querySelectorAll("#salas-tbody tr[data-search]").forEach((row) => {
      row.style.display = !q || row.dataset.search.includes(q) ? "" : "none";
    });
  } else if (route === "#usuarios") {
    document
      .querySelectorAll("#usuarios-tbody tr[data-search]")
      .forEach((row) => {
        row.style.display = !q || row.dataset.search.includes(q) ? "" : "none";
      });
  }
};

// Versões debounced das buscas (evita laggar com listas grandes)
App.globalSearchDebounced = UI.debounce(App.globalSearch, 200);
App.modules.equipamentos.applyFiltersDebounced = UI.debounce(
  () => App.modules.equipamentos.applyFilters(), 200
);
App.modules.rastreio.applyFiltersDebounced = UI.debounce(
  () => App.modules.rastreio.applyFilters(), 200
);
App.modules.movimentacoes.applyFiltersDebounced = UI.debounce(
  () => App.modules.movimentacoes.applyFilters(), 200
);
App.modules.mapaSalas.applyFiltersDebounced = UI.debounce(
  () => App.modules.mapaSalas.applyFilters(), 200
);
