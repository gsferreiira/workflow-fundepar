// views.js

const escapeHtml = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

// Formata número de patrimônio como 000.000.000.000
const formatAssetNumber = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 12) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}`;
  }
  return String(raw);
};

// Máscara progressiva para campos de patrimônio
const maskAssetNumber = (e) => {
  const input = e.target || e;
  const digits = input.value.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 3) input.value = digits;
  else if (digits.length <= 6)
    input.value = `${digits.slice(0, 3)}.${digits.slice(3)}`;
  else if (digits.length <= 9)
    input.value = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  else
    input.value = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`;
};

const Views = {
  auth: {
    login: () => `
            <div class="auth-card">
                <div style="background: var(--primary-color); color: white; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; border-radius: 12px; margin: 0 auto 16px auto;">F</div>
                <h2>Bem-vindo de volta</h2>
                <p class="subtitle">Faça login para acessar a área de gestão.</p>
                <form id="login-form">
                    <div class="form-group">
                        <label for="login-email">E-mail</label>
                        <input type="email" id="login-email" class="form-control" required placeholder="exemplo@fundepar.gov.br">
                    </div>
                    <div class="form-group">
                        <label for="login-password">Senha</label>
                        <input type="password" id="login-password" class="form-control" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn-primary">Entrar no Sistema</button>
                </form>
                <div class="auth-footer">
                    Não possui acesso? <a href="#" id="go-to-register">Criar Conta</a>
                </div>
            </div>
        `,
    register: () => `
            <div class="auth-card">
                <div style="background: var(--primary-color); color: white; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; border-radius: 12px; margin: 0 auto 16px auto;">F</div>
                <h2>Cadastrar Acesso</h2>
                <p class="subtitle">Preencha seus dados para solicitar acesso.</p>
                <form id="register-form">
                    <div class="form-group">
                        <label for="register-name">Nome Completo</label>
                        <input type="text" id="register-name" class="form-control" required placeholder="Ex: Maria Souza">
                    </div>
                    <div class="form-group">
                        <label for="register-email">E-mail Corporativo</label>
                        <input type="email" id="register-email" class="form-control" required placeholder="nome@fundepar.gov.br">
                    </div>
                    <div class="form-group">
                        <label for="register-password">Senha Segura</label>
                        <input type="password" id="register-password" class="form-control" required placeholder="Mínimo 6 caracteres">
                    </div>
                    <button type="submit" class="btn-primary">Registrar</button>
                </form>
                <div class="auth-footer">
                    Já possui acesso? <a href="#" id="go-to-login">Fazer Login</a>
                </div>
            </div>
        `,
  },

  app: {
    /* ── DASHBOARD ───────────────────────────────────────────────── */
    dashboard: (stats, recentMovements, chartData) => `
            <div class="view-header">
                <div>
                    <h2>Olá, ${escapeHtml(Auth.user.full_name) || "Usuário"}</h2>
                    <p>Resumo da operação e controle de atividades hoje.</p>
                </div>
            </div>
            <div class="stat-grid fade-in">
                <div class="stat-card">
                    <div class="icon-box"><i data-lucide="ticket"></i></div>
                    <div><div class="value">${stats.totalOpen || 0}</div><div class="label">Chamados Pendentes</div></div>
                </div>
                <div class="stat-card">
                    <div class="icon-box" style="background:rgba(16,185,129,.1);color:var(--success-color);"><i data-lucide="check-circle"></i></div>
                    <div><div class="value">${stats.totalResolved || 0}</div><div class="label">Chamados Resolvidos</div></div>
                </div>
                <div class="stat-card">
                    <div class="icon-box" style="background:rgba(245,158,11,.1);color:var(--warning-color);"><i data-lucide="map-pin"></i></div>
                    <div><div class="value">${stats.totalRooms || 0}</div><div class="label">Locais / Salas</div></div>
                </div>
                <div class="stat-card">
                    <div class="icon-box" style="background:rgba(99,102,241,.1);color:#6366f1;"><i data-lucide="package"></i></div>
                    <div><div class="value">${stats.totalEquipment || 0}</div><div class="label">Equipamentos</div></div>
                </div>
            </div>
            ${
              chartData && chartData.length > 0
                ? (() => {
                    const max = Math.max(...chartData.map((c) => c.count), 1);
                    return `
            <div class="dashboard-section fade-in" style="margin-bottom:28px;">
                <div class="dashboard-section-header">
                    <h3><i data-lucide="bar-chart-2" style="width:16px;vertical-align:middle;margin-right:6px;"></i>Movimentações por Mês</h3>
                    <span style="font-size:13px;color:var(--text-secondary);">Últimos 6 meses</span>
                </div>
                <div class="table-card" style="padding:20px 24px 16px;">
                    <div class="chart-wrap">
                        <div class="chart-bars">
                            ${chartData
                              .map(
                                (c) => `
                                <div class="chart-col${c.count === 0 ? " chart-zero" : ""}" title="${c.count} movimentação${c.count !== 1 ? "ões" : ""} em ${c.label}">
                                    <div class="chart-col-val">${c.count > 0 ? c.count : ""}</div>
                                    <div class="chart-bar" style="height:${Math.round((c.count / max) * 88) + 4}px;"></div>
                                </div>
                            `,
                              )
                              .join("")}
                        </div>
                        <div style="display:flex;gap:8px;margin-top:2px;">
                            ${chartData.map((c) => `<div class="chart-col-label" style="flex:1;text-align:center;">${c.label}</div>`).join("")}
                        </div>
                    </div>
                </div>
            </div>`;
                  })()
                : ""
            }
            ${
              recentMovements && recentMovements.length > 0
                ? `
            <div class="dashboard-section fade-in">
                <div class="dashboard-section-header">
                    <h3><i data-lucide="arrow-right-left" style="width:16px;vertical-align:middle;margin-right:6px;"></i>Movimentações Recentes</h3>
                    <a href="#movimentacoes" class="dashboard-section-link" onclick="App.handleRoute()">Ver todas <i data-lucide="arrow-right" style="width:13px;vertical-align:middle;"></i></a>
                </div>
                <div class="table-card" style="padding:0;">
                    <table class="data-table" style="min-width:500px;">
                        <thead><tr>
                            <th>Equipamento</th>
                            <th>De</th>
                            <th>Para</th>
                            <th>Responsável</th>
                            <th>Data</th>
                        </tr></thead>
                        <tbody>
                            ${recentMovements
                              .map(
                                (m) => `
                                <tr>
                                    <td><strong>${m.equipment ? escapeHtml(m.equipment.name) : "—"}</strong></td>
                                    <td style="color:var(--text-secondary);">
                                        <span style="display:flex;align-items:center;gap:4px;">
                                            <i data-lucide="map-pin" style="width:12px;flex-shrink:0;"></i>
                                            ${m.origin ? escapeHtml(m.origin.name) : "—"}
                                        </span>
                                    </td>
                                    <td>
                                        <span style="display:flex;align-items:center;gap:4px;color:var(--accent-color);">
                                            <i data-lucide="map-pin" style="width:12px;flex-shrink:0;"></i>
                                            ${m.destination ? escapeHtml(m.destination.name) : "—"}
                                        </span>
                                    </td>
                                    <td style="color:var(--text-secondary);">${m.profiles ? escapeHtml(m.profiles.full_name) : "—"}</td>
                                    <td style="color:var(--text-secondary);white-space:nowrap;font-size:13px;">
                                        ${new Date(m.moved_at).toLocaleDateString("pt-BR")}
                                        <span style="opacity:.6;"> ${new Date(m.moved_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                    </td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>`
                : ""
            }
        `,

    /* ── EQUIPAMENTOS ────────────────────────────────────────────── */
    equipamentos: (equipamentos) => {
      const categorias = [
        ...new Set(
          equipamentos.filter((e) => e.categoria).map((e) => e.categoria),
        ),
      ].sort();
      const statusOpts = ["novo", "bom", "regular", "inservível"];
      return `
            <div class="view-header">
                <div>
                    <h2>Equipamentos</h2>
                    <p>Cadastre os equipamentos que poderão ser movimentados.</p>
                </div>
                <button class="btn-primary" onclick="App.modules.equipamentos.showCreateModal()"><i data-lucide="plus"></i> Cadastrar Equipamento</button>
            </div>
            <div class="filter-bar fade-in">
                <div class="filter-row">
                    <div class="filter-group" style="flex:2;min-width:180px;">
                        <label class="filter-label">Pesquisar</label>
                        <input type="text" id="equip-search" class="form-control filter-control" placeholder="Nome ou observação..."
                               oninput="App.modules.equipamentos.applyFilters()">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Categoria</label>
                        <select id="equip-filter-cat" class="form-control filter-control" onchange="App.modules.equipamentos.applyFilters()">
                            <option value="">Todas</option>
                            ${categorias.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Status</label>
                        <select id="equip-filter-status" class="form-control filter-control" onchange="App.modules.equipamentos.applyFilters()">
                            <option value="">Todos</option>
                            ${statusOpts.map((s) => `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div class="filter-actions">
                    <span id="equip-result-count" class="filter-count">${equipamentos.length} equipamento${equipamentos.length !== 1 ? "s" : ""}</span>
                    <button class="btn-filter-clear" onclick="['equip-search','equip-filter-cat','equip-filter-status'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});App.modules.equipamentos.applyFilters()">
                        <i data-lucide="x"></i> Limpar
                    </button>
                </div>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead><tr>
                        <th>Nome do Equipamento</th>
                        <th>Categoria</th>
                        <th>Status</th>
                        <th>Observação</th>
                        <th>Cadastrado em</th>
                        <th style="width:130px;">Ações</th>
                    </tr></thead>
                    <tbody id="equipamentos-tbody">
                        ${Views.app._equipamentosRows(equipamentos)}
                    </tbody>
                </table>
            </div>
        `;
    },

    _equipamentosRows: (rows) => {
      if (rows.length === 0)
        return '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum equipamento encontrado.</td></tr>';
      return rows
        .map(
          (eq) => `
                <tr data-search="${escapeHtml((eq.name + " " + (eq.categoria || "") + " " + (eq.observacao || "")).toLowerCase())}">
                    <td><strong>${escapeHtml(eq.name)}</strong></td>
                    <td>${eq.categoria ? `<span style="background:rgba(99,102,241,.1);color:#6366f1;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:600;">${escapeHtml(eq.categoria)}</span>` : '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td>${Views.app._statusBadge(eq.status)}</td>
                    <td style="color:var(--text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(eq.observacao || "")}">${escapeHtml(eq.observacao) || "—"}</td>
                    <td style="color:var(--text-secondary);">${new Date(eq.created_at).toLocaleDateString("pt-BR")}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-table-action edit" onclick="App.modules.equipamentos.editEquipamento('${escapeHtml(eq.id)}')"><i data-lucide="pencil"></i> Editar</button>
                            <button class="btn-table-action delete" onclick="App.modules.equipamentos.deleteEquipamento(this,'${escapeHtml(eq.id)}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </td>
                </tr>
            `,
        )
        .join("");
    },

    _statusBadge: (status) => {
      const map = {
        novo: { bg: "rgba(16,185,129,.12)", color: "#059669" },
        bom: { bg: "rgba(59,130,246,.12)", color: "#2563eb" },
        regular: { bg: "rgba(245,158,11,.12)", color: "#d97706" },
        inservível: { bg: "rgba(239,68,68,.12)", color: "#dc2626" },
      };
      const s = (status || "").toLowerCase();
      const c = map[s] || {
        bg: "rgba(0,0,0,.06)",
        color: "var(--text-secondary)",
      };
      const label = status
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : "—";
      return `<span style="background:${c.bg};color:${c.color};padding:2px 8px;border-radius:20px;font-size:12px;font-weight:600;">${escapeHtml(label)}</span>`;
    },

    equipamentoModal: () => `
            <div class="modal-overlay" id="equipamento-modal">
                <div class="modal-content" style="max-width:520px;">
                    <div class="modal-header">
                        <h3>Cadastrar Equipamento</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('equipamento-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-new-equipamento" onsubmit="App.modules.equipamentos.create(event)">
                        <div class="form-group">
                            <label>Nome do Equipamento <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="equip-name" class="form-control" required placeholder="Ex: Notebook Dell Latitude 5520">
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Categoria</label>
                                <input type="text" id="equip-categoria" class="form-control" placeholder="Ex: Computador, Monitor, Switch..." list="equip-cat-list">
                                <datalist id="equip-cat-list">
                                    <option value="Computador"><option value="Notebook"><option value="Monitor">
                                    <option value="Switch"><option value="Roteador"><option value="Impressora">
                                    <option value="Projetor"><option value="Teclado"><option value="Mouse">
                                    <option value="Servidor"><option value="No-break"><option value="Câmera">
                                </datalist>
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="equip-status" class="form-control">
                                    <option value="bom">Bom</option>
                                    <option value="novo">Novo</option>
                                    <option value="regular">Regular</option>
                                    <option value="inservível">Inservível</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Observação <span style="color:var(--text-secondary);font-weight:400;">(Opcional)</span></label>
                            <textarea id="equip-observacao" class="form-control" rows="2" placeholder="Ex: Tela com risco vertical, bateria fraca..."></textarea>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('equipamento-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Cadastrar</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    equipamentoEditModal: (eq) => `
            <div class="modal-overlay" id="equipamento-edit-modal">
                <div class="modal-content" style="max-width:520px;">
                    <div class="modal-header">
                        <h3>Editar Equipamento</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('equipamento-edit-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-edit-equipamento" onsubmit="App.modules.equipamentos.updateEquipamento(event,'${escapeHtml(eq.id)}')">
                        <div class="form-group">
                            <label>Nome do Equipamento <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="edit-equip-name" class="form-control" required value="${escapeHtml(eq.name)}">
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Categoria</label>
                                <input type="text" id="edit-equip-categoria" class="form-control" value="${escapeHtml(eq.categoria || "")}" placeholder="Ex: Computador, Monitor..." list="edit-cat-list">
                                <datalist id="edit-cat-list">
                                    <option value="Computador"><option value="Notebook"><option value="Monitor">
                                    <option value="Switch"><option value="Roteador"><option value="Impressora">
                                    <option value="Projetor"><option value="Teclado"><option value="Mouse">
                                    <option value="Servidor"><option value="No-break"><option value="Câmera">
                                </datalist>
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="edit-equip-status" class="form-control">
                                    ${["bom", "novo", "regular", "inservível"]
                                      .map(
                                        (s) =>
                                          `<option value="${s}" ${eq.status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
                                      )
                                      .join("")}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Observação <span style="color:var(--text-secondary);font-weight:400;">(Opcional)</span></label>
                            <textarea id="edit-equip-observacao" class="form-control" rows="2" placeholder="Ex: Tela com risco vertical...">${escapeHtml(eq.observacao || "")}</textarea>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('equipamento-edit-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    /* ── MOVIMENTAÇÕES ───────────────────────────────────────────── */
    movimentacoesRows: (rows) =>
      rows.length === 0
        ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhuma movimentação encontrada.</td></tr>`
        : rows
            .map(
              (m) => `
                <tr>
                    <td><strong>${m.equipment ? escapeHtml(m.equipment.name) : "—"}</strong></td>
                    <td style="color:var(--text-secondary)">${escapeHtml(m.serial_number) || "—"}</td>
                    <td style="color:var(--text-secondary)">${formatAssetNumber(m.asset_number) || "—"}</td>
                    <td>
                        <span style="display:flex;align-items:center;gap:4px;color:var(--text-secondary)">
                            <i data-lucide="map-pin" style="width:12px;flex-shrink:0"></i>
                            ${m.origin ? escapeHtml(m.origin.name) : "—"}
                        </span>
                    </td>
                    <td>
                        <span style="display:flex;align-items:center;gap:4px;color:var(--accent-color)">
                            <i data-lucide="map-pin" style="width:12px;flex-shrink:0"></i>
                            ${m.destination ? escapeHtml(m.destination.name) : "—"}
                        </span>
                    </td>
                    <td>${m.profiles ? escapeHtml(m.profiles.full_name) : "—"}</td>
                    <td>${escapeHtml(m.received_by) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td style="color:var(--text-secondary);white-space:nowrap;">
                        ${new Date(m.moved_at).toLocaleDateString("pt-BR")}
                        <span style="font-size:12px;opacity:.7"> ${new Date(m.moved_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td>
                        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                            <button class="btn-table-action edit" title="Editar" onclick="App.modules.movimentacoes.showEditModal('${escapeHtml(m.id)}')"><i data-lucide="pencil"></i></button>
                            <button class="btn-table-action delete" title="Excluir" onclick="App.modules.movimentacoes.delete(this,'${escapeHtml(m.id)}')"><i data-lucide="trash-2"></i></button>
                            ${m.is_edited ? `<button class="badge-edited" onclick="App.modules.movimentacoes.showEditInfo('${escapeHtml(m.id)}')" title="Ver histórico de edições"><i data-lucide="history"></i> Editado</button>` : ""}
                        </div>
                    </td>
                </tr>
            `,
            )
            .join(""),

    movimentacoes: (movimentacoes, equipment, rooms, profiles) => `
            <div class="view-header">
                <div>
                    <h2>Movimentações de Patrimônio</h2>
                    <p>Registro de transferência e controle de equipamentos.</p>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn-primary" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-color);"
                            onclick="App.modules.movimentacoes.exportExcel()">
                        <i data-lucide="file-spreadsheet"></i> Exportar Excel
                    </button>
                    ${
                      Auth.user?.role === "admin"
                        ? `
                    <button class="btn-primary" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-color);"
                            onclick="App.modules.movimentacoes.openImportPicker()">
                        <i data-lucide="upload"></i> Importar Excel
                    </button>
                    <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none"
                           onchange="App.modules.movimentacoes.handleImportFile(this)">`
                        : ""
                    }
                    <button class="btn-primary" onclick="App.modules.movimentacoes.showCreateModal()"><i data-lucide="plus"></i> Registrar Movimentação</button>
                </div>
            </div>
            <div class="filter-bar fade-in">
                <div class="filter-row">
                    <div class="filter-group">
                        <label class="filter-label">De</label>
                        <input type="date" id="filter-date-from" class="form-control filter-control" onchange="App.modules.movimentacoes.applyFilters()">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Até</label>
                        <input type="date" id="filter-date-to" class="form-control filter-control" onchange="App.modules.movimentacoes.applyFilters()">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Equipamento</label>
                        <select id="filter-equipment" class="form-control filter-control" onchange="App.modules.movimentacoes.applyFilters()">
                            <option value="">Todos equipamentos</option>
                            ${equipment.map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Origem</label>
                        <select id="filter-origin" class="form-control filter-control" onchange="App.modules.movimentacoes.applyFilters()">
                            <option value="">Todas origens</option>
                            ${rooms.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Destino</label>
                        <select id="filter-dest" class="form-control filter-control" onchange="App.modules.movimentacoes.applyFilters()">
                            <option value="">Todos destinos</option>
                            ${rooms.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Patrimônio</label>
                        <input type="text"
                            id="filter-asset"
                            class="form-control filter-control"
                            placeholder="000.000.000.000"
                            oninput="App.modules.movimentacoes.applyFilters()">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Responsável</label>
                        <select id="filter-responsible" class="form-control filter-control" onchange="App.modules.movimentacoes.applyFilters()">
                            <option value="">Todos responsáveis</option>
                            ${profiles.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.full_name)}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div class="filter-actions">
                    <span id="filter-result-count" class="filter-count">${movimentacoes.length} resultado${movimentacoes.length !== 1 ? "s" : ""}</span>
                    <button class="btn-filter-clear" onclick="App.modules.movimentacoes.clearFilters()">
                        <i data-lucide="x"></i> Limpar filtros
                    </button>
                </div>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead><tr>
                        <th>Equipamento</th>
                        <th>Nº Série</th>
                        <th>Nº Patrimônio</th>
                        <th>Origem</th>
                        <th>Destino</th>
                        <th>Responsável</th>
                        <th>Recebedor</th>
                        <th>Data / Hora</th>
                        <th style="width:120px;">Ações</th>
                    </tr></thead>
                    <tbody id="movimentacoes-tbody">
                        ${Views.app.movimentacoesRows(movimentacoes.slice(0, 25))}
                    </tbody>
                </table>
            </div>
            <div id="mov-pagination">
                ${Views.app.movimentacoesPagination(1, movimentacoes.length, 25)}
            </div>
        `,

    movimentacoesPagination: (page, total, pageSize) => {
      const totalPages = Math.ceil(total / pageSize);
      if (totalPages <= 1) return "";
      const from = (page - 1) * pageSize + 1;
      const to = Math.min(page * pageSize, total);
      return `
            <div class="pagination fade-in">
                <span class="pagination-info">${from}–${to} de ${total}</span>
                <div class="pagination-controls">
                    <button class="pagination-btn" ${page <= 1 ? "disabled" : ""} onclick="App.modules.movimentacoes.prevPage()">
                        <i data-lucide="chevron-left" style="width:15px;"></i> Anterior
                    </button>
                    <span class="pagination-pages">Página ${page} de ${totalPages}</span>
                    <button class="pagination-btn" ${page >= totalPages ? "disabled" : ""} onclick="App.modules.movimentacoes.nextPage()">
                        Próxima <i data-lucide="chevron-right" style="width:15px;"></i>
                    </button>
                </div>
            </div>`;
    },

    importPreviewModal: (rows) => {
      const total = rows.length;
      const ok = rows.filter((r) => r.status === "ok").length;
      const warn = rows.filter((r) => r.status === "warn").length;
      const err = rows.filter((r) => r.status === "error").length;
      return `
            <div class="modal-overlay" id="import-preview-modal">
                <div class="modal-content" style="max-width:900px;">
                    <div class="modal-header">
                        <div>
                            <h3>Prévia da Importação</h3>
                            <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">
                                ${total} linha${total !== 1 ? "s" : ""} &nbsp;·&nbsp;
                                <span style="color:#16a34a;font-weight:600;">${ok} prontas</span>&nbsp;·&nbsp;
                                <span style="color:#d97706;font-weight:600;">${warn} com aviso</span>&nbsp;·&nbsp;
                                <span style="color:var(--danger-color);font-weight:600;">${err} com erro</span>
                            </div>
                        </div>
                        <button class="modal-close" type="button" onclick="document.getElementById('import-preview-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">
                        Linhas com <strong>erro</strong> (equipamento ou destino não encontrado) serão ignoradas.
                        Linhas com <strong>aviso</strong> têm campos opcionais em branco e serão importadas assim mesmo.
                    </p>
                    <div style="max-height:55vh;overflow-y:auto;border:1px solid var(--border-color);border-radius:10px;">
                        <table class="data-table" style="min-width:700px;">
                            <thead><tr>
                                <th style="width:36px;"></th>
                                <th>Equipamento</th>
                                <th>Nº Patrimônio</th>
                                <th>Origem</th>
                                <th>Destino</th>
                                <th>Recebedor</th>
                                <th>Data / Hora</th>
                            </tr></thead>
                            <tbody>
                                ${rows
                                  .map(
                                    (r, i) => `
                                    <tr style="${r.status === "error" ? "opacity:.5;" : ""}">
                                        <td>
                                            ${r.status === "ok" ? `<span style="color:#16a34a;font-size:16px;" title="Pronta">✓</span>` : ""}
                                            ${r.status === "warn" ? `<span style="color:#d97706;font-size:16px;" title="${escapeHtml(r.warnings.join(", "))}">⚠</span>` : ""}
                                            ${r.status === "error" ? `<span style="color:var(--danger-color);font-size:16px;" title="${escapeHtml(r.errors.join(", "))}">✗</span>` : ""}
                                        </td>
                                        <td>
                                            <strong>${escapeHtml(r.equipmentName)}</strong>
                                            ${!r.equipmentId ? `<div style="font-size:11px;color:var(--danger-color);">Não encontrado</div>` : ""}
                                        </td>
                                        <td style="color:var(--text-secondary)">${formatAssetNumber(r.assetNumber) || "—"}</td>
                                        <td style="color:var(--text-secondary)">
                                            ${escapeHtml(r.originName) || '<span style="opacity:.4">—</span>'}
                                            ${r.originName && !r.originId ? `<div style="font-size:11px;color:#d97706;">Não encontrada</div>` : ""}
                                        </td>
                                        <td>
                                            ${escapeHtml(r.destName) || '<span style="color:var(--danger-color)">Não informado</span>'}
                                            ${r.destName && !r.destId ? `<div style="font-size:11px;color:var(--danger-color);">Não encontrada</div>` : ""}
                                        </td>
                                        <td style="color:var(--text-secondary)">${escapeHtml(r.receivedBy) || "—"}</td>
                                        <td style="color:var(--text-secondary);white-space:nowrap;">${r.movedAtDisplay || '<span style="opacity:.4">Agora</span>'}</td>
                                    </tr>
                                `,
                                  )
                                  .join("")}
                            </tbody>
                        </table>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;flex-wrap:wrap;gap:12px;">
                        <span style="font-size:13px;color:var(--text-secondary);">${ok + warn} linha${ok + warn !== 1 ? "s" : ""} serão importadas · ${err} serão ignoradas</span>
                        <div style="display:flex;gap:10px;">
                            <button class="btn-primary" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-color);"
                                    onclick="document.getElementById('import-preview-modal').remove()">Cancelar</button>
                            <button class="btn-primary" ${ok + warn === 0 ? "disabled" : ""}
                                    onclick="App.modules.movimentacoes.confirmImport()">
                                <i data-lucide="check"></i> Confirmar Importação (${ok + warn})
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    movimentacaoModal: (
      equipment,
      rooms,
      prefillAsset = null,
      prefillOriginId = null,
      prefillOriginName = null,
    ) => {
      const now = new Date();
      return `
                <div class="modal-overlay" id="movimentacao-modal">
                    <div class="modal-content" style="max-width:580px;">
                        <div class="modal-header">
                            <h3>Registrar Movimentação</h3>
                            <button class="modal-close" type="button" onclick="document.getElementById('movimentacao-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                        <form id="form-new-movimentacao" onsubmit="App.modules.movimentacoes.create(event)">
                            <div class="form-group">
                                <label>Equipamento <span style="color:var(--danger-color)">*</span></label>
                                <input type="hidden" id="mov-equipment-id">
                                <div class="autocomplete-wrapper" id="wrap-mov-equip">
                                    <input type="text" id="mov-equipment-name" class="form-control" required
                                           placeholder="Toque para ver os equipamentos..." autocomplete="off"
                                           onfocus="Autocomplete.show('wrap-mov-equip')"
                                           onblur="Autocomplete.hide('wrap-mov-equip')"
                                           oninput="Autocomplete.filter('wrap-mov-equip')">
                                    <div class="autocomplete-list" id="wrap-mov-equip-list">
                                        ${
                                          equipment.length === 0
                                            ? `<div class="autocomplete-empty">Nenhum equipamento. <a href="#equipamentos" style="color:var(--accent-color)" onclick="document.getElementById('movimentacao-modal').remove()">Cadastre primeiro →</a></div>`
                                            : equipment
                                                .map(
                                                  (e) =>
                                                    `<div class="autocomplete-item" data-label="${escapeHtml(e.name)}" onpointerdown="event.preventDefault();Autocomplete.pick('wrap-mov-equip','${escapeHtml(e.id)}','${escapeHtml(e.name)}','mov-equipment-id')">${escapeHtml(e.name)}</div>`,
                                                )
                                                .join("")
                                        }
                                    </div>
                                </div>
                            </div>

                            <div class="form-2col">
                                <div class="form-group">
                                    <label>Nº de Série <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                    <input type="text" id="mov-serial" class="form-control" placeholder="Ex: SN123456789">
                                </div>
                                <div class="form-group">
                                    <label>Nº Patrimônio <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                    <input type="text" id="mov-asset-number" class="form-control" placeholder="Ex: 000.000.000.000"
                                           value="${prefillAsset ? escapeHtml(formatAssetNumber(prefillAsset)) : ""}"
                                           oninput="maskAssetNumber(event)"
                                           onblur="App.modules.movimentacoes.lookupAndFillOrigin(this.value)">
                                </div>
                            </div>

                            <div class="form-2col">
                                <div class="form-group">
                                    <label>Origem <span style="color:var(--danger-color)">*</span></label>
                                    <input type="hidden" id="mov-origin-id" value="${prefillOriginId ? escapeHtml(prefillOriginId) : ""}">
                                    <div class="autocomplete-wrapper" id="wrap-mov-origin">
                                        <input type="text" class="form-control" required placeholder="Toque para ver as salas..." autocomplete="off"
                                               value="${prefillOriginName ? escapeHtml(prefillOriginName) : ""}"
                                               onfocus="Autocomplete.show('wrap-mov-origin')"
                                               onblur="Autocomplete.hide('wrap-mov-origin')"
                                               oninput="Autocomplete.filter('wrap-mov-origin')">
                                        <div class="autocomplete-list" id="wrap-mov-origin-list">
                                            ${rooms.map((r) => `<div class="autocomplete-item" data-label="${escapeHtml(r.name)}" onpointerdown="event.preventDefault();Autocomplete.pick('wrap-mov-origin','${escapeHtml(r.id)}','${escapeHtml(r.name)}','mov-origin-id')">${escapeHtml(r.name)}</div>`).join("")}
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Destino <span style="color:var(--danger-color)">*</span></label>
                                    <input type="hidden" id="mov-destination-id">
                                    <div class="autocomplete-wrapper" id="wrap-mov-dest">
                                        <input type="text" class="form-control" required placeholder="Toque para ver as salas..." autocomplete="off"
                                               onfocus="Autocomplete.show('wrap-mov-dest')"
                                               onblur="Autocomplete.hide('wrap-mov-dest')"
                                               oninput="Autocomplete.filter('wrap-mov-dest')">
                                        <div class="autocomplete-list" id="wrap-mov-dest-list">
                                            ${rooms.map((r) => `<div class="autocomplete-item" data-label="${escapeHtml(r.name)}" onpointerdown="event.preventDefault();Autocomplete.pick('wrap-mov-dest','${escapeHtml(r.id)}','${escapeHtml(r.name)}','mov-destination-id')">${escapeHtml(r.name)}</div>`).join("")}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="form-2col">
                                <div class="form-group">
                                    <label>Responsável pela Movimentação</label>
                                    <input type="text" class="form-control" readonly value="${escapeHtml(Auth.user.full_name || Auth.user.email)}">
                                </div>
                                <div class="form-group">
                                    <label>Recebedor <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                    <input type="text" id="mov-received-by" class="form-control" placeholder="Nome de quem recebe...">
                                </div>
                            </div>

                            <div class="form-2col">
                                <div class="form-group">
                                    <label>Data / Hora</label>
                                    <input type="text" class="form-control" readonly value="${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}">
                                </div>
                                <div class="form-group">
                                    <label>Estado do Item</label>
                                    <select id="mov-item-status" class="form-control">
                                        <option value="">Não informado</option>
                                        <option value="novo">Novo</option>
                                        <option value="bom">Bom</option>
                                        <option value="regular">Regular</option>
                                        <option value="inservível">Inservível</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Comentário <span style="color:var(--text-secondary);font-weight:400;">(Opcional)</span></label>
                                <textarea id="mov-comentario" class="form-control" rows="2" placeholder="Ex: Tela com risco vertical, cabo danificado..."></textarea>
                            </div>

                            <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
                                <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('movimentacao-modal').remove()">Cancelar</button>
                                <button type="submit" class="btn-primary">Registrar Movimentação</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
    },

    /* ── RASTREIO ────────────────────────────────────────────────── */
    rastreio: (data, rooms, categorias) => `
            <div class="view-header">
                <div>
                    <h2>Rastreio de Patrimônio</h2>
                    <p>Localização atual de todos os equipamentos cadastrados.</p>
                </div>
                <button class="btn-primary" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-color);"
                        onclick="App.modules.rastreio.exportExcel()">
                    <i data-lucide="file-spreadsheet"></i> Exportar Excel
                </button>
            </div>
            <div class="filter-bar fade-in">
                <div class="filter-row">
                    <div class="filter-group" style="flex:2;min-width:180px;">
                        <label class="filter-label">Pesquisar</label>
                        <input type="text" id="rastreio-search" class="form-control filter-control"
                               placeholder="Nome, nº patrimônio, série, recebedor..."
                               oninput="App.modules.rastreio.applyFilters()">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Sala Atual</label>
                        <select id="rastreio-filter-room" class="form-control filter-control" onchange="App.modules.rastreio.applyFilters()">
                            <option value="">Todas as salas</option>
                            <option value="__sem_sala__">Sem localização</option>
                            ${(rooms || []).map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Categoria</label>
                        <select id="rastreio-filter-cat" class="form-control filter-control" onchange="App.modules.rastreio.applyFilters()">
                            <option value="">Todas</option>
                            ${(categorias || []).map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Status</label>
                        <select id="rastreio-filter-status" class="form-control filter-control" onchange="App.modules.rastreio.applyFilters()">
                            <option value="">Todos</option>
                            ${["novo", "bom", "regular", "inservível"]
                              .map(
                                (s) =>
                                  `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`,
                              )
                              .join("")}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Ordenar por</label>
                        <select id="rastreio-sort" class="form-control filter-control" onchange="App.modules.rastreio.applyFilters()">
                            <option value="az">Nome A–Z</option>
                            <option value="za">Nome Z–A</option>
                            <option value="pat">Nº Patrimônio</option>
                            <option value="sala">Sala</option>
                            <option value="cat">Categoria</option>
                        </select>
                    </div>
                </div>
                <div class="filter-actions">
                    <span id="rastreio-result-count" class="filter-count">${data.length} equipamento${data.length !== 1 ? "s" : ""}</span>
                    <button class="btn-filter-clear" onclick="['rastreio-search','rastreio-filter-room','rastreio-filter-cat','rastreio-filter-status'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});document.getElementById('rastreio-sort').value='az';App.modules.rastreio.applyFilters()">
                        <i data-lucide="x"></i> Limpar filtros
                    </button>
                </div>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead><tr>
                        <th>Equipamento</th>
                        <th>Categoria</th>
                        <th>Status</th>
                        <th>Nº Patrimônio</th>
                        <th>Localização Atual</th>
                        <th>Com quem está</th>
                        <th>Última Movimentação</th>
                        <th style="width:60px;"></th>
                    </tr></thead>
                    <tbody id="rastreio-tbody">
                        ${Views.app._rastreioRows(data)}
                    </tbody>
                </table>
            </div>
        `,

    _rastreioRows: (data) => {
      if (data.length === 0)
        return `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum equipamento encontrado.</td></tr>`;
      return data
        .map(
          (d) => `
                <tr>
                    <td>
                        <strong>${d.equipment ? escapeHtml(d.equipment.name) : "—"}</strong>
                        ${d.observacao ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;" title="${escapeHtml(d.observacao)}">${escapeHtml(d.observacao.slice(0, 40))}${d.observacao.length > 40 ? "…" : ""}</div>` : ""}
                    </td>
                    <td>${d.categoria ? `<span style="background:rgba(99,102,241,.1);color:#6366f1;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:600;">${escapeHtml(d.categoria)}</span>` : '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td>${Views.app._statusBadge(d.status)}</td>
                    <td>${formatAssetNumber(d.asset_number) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td>${
                      d.room
                        ? `<span class="location-tag"><i data-lucide="map-pin" style="width:13px;flex-shrink:0;"></i>${escapeHtml(d.room.name)}</span>`
                        : `<span style="color:var(--text-secondary);font-style:italic;font-size:13px;">Não localizado</span>`
                    }
                    </td>
                    <td>${escapeHtml(d.received_by) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td style="color:var(--text-secondary);white-space:nowrap;">
                        ${
                          d.moved_at
                            ? `${new Date(d.moved_at).toLocaleDateString("pt-BR")}<span style="font-size:12px;opacity:.7;"> ${new Date(d.moved_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>`
                            : '<span style="font-style:italic;font-size:13px;">Nunca movimentado</span>'
                        }
                    </td>
                    <td>
                        <button class="btn-table-action edit" title="Ver histórico"
                                onclick="App.modules.rastreio.showHistory('${escapeHtml(d.equipment_id)}','${escapeHtml(d.equipment?.name || "")}')">
                            <i data-lucide="history"></i>
                        </button>
                    </td>
                </tr>
            `,
        )
        .join("");
    },

    rastreioHistoryModal: (equipmentName, movements) => `
            <div class="modal-overlay" id="rastreio-history-modal">
                <div class="modal-content" style="max-width:720px;">
                    <div class="modal-header">
                        <div>
                            <h3>${escapeHtml(equipmentName)}</h3>
                            <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">Histórico completo de movimentações</div>
                        </div>
                        <button class="modal-close" type="button" onclick="document.getElementById('rastreio-history-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <div style="max-height:60vh;overflow-y:auto;border:1px solid var(--border-color);border-radius:10px;">
                        <table class="data-table" style="min-width:560px;">
                            <thead><tr>
                                <th>De</th>
                                <th>Para</th>
                                <th>Responsável</th>
                                <th>Recebedor</th>
                                <th>Data</th>
                            </tr></thead>
                            <tbody>
                                ${
                                  movements.length === 0
                                    ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhuma movimentação registrada.</td></tr>`
                                    : movements
                                        .map(
                                          (m, i) => `
                                        <tr>
                                            <td style="color:var(--text-secondary);">
                                                <span style="display:flex;align-items:center;gap:4px;">
                                                    <i data-lucide="map-pin" style="width:12px;flex-shrink:0;"></i>
                                                    ${m.origin_room ? escapeHtml(m.origin_room.name) : "—"}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="display:flex;align-items:center;gap:4px;color:var(--accent-color);font-weight:600;">
                                                    <i data-lucide="map-pin" style="width:12px;flex-shrink:0;"></i>
                                                    ${m.destination_room ? escapeHtml(m.destination_room.name) : "—"}
                                                </span>
                                                ${i === 0 ? `<span style="font-size:10px;background:rgba(14,165,233,.1);color:var(--accent-color);padding:2px 6px;border-radius:99px;margin-left:4px;font-weight:700;">ATUAL</span>` : ""}
                                            </td>
                                            <td>${m.profile ? escapeHtml(m.profile.full_name) : "—"}</td>
                                            <td style="color:var(--text-secondary);">${escapeHtml(m.received_by) || "—"}</td>
                                            <td style="color:var(--text-secondary);white-space:nowrap;">
                                                ${new Date(m.moved_at).toLocaleDateString("pt-BR")}
                                                <span style="font-size:12px;opacity:.7;"> ${new Date(m.moved_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                            </td>
                                        </tr>
                                    `,
                                        )
                                        .join("")
                                }
                            </tbody>
                        </table>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;">
                        <span style="font-size:13px;color:var(--text-secondary);">${movements.length} movimentaç${movements.length !== 1 ? "ões" : "ão"} registrada${movements.length !== 1 ? "s" : ""}</span>
                        <button class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('rastreio-history-modal').remove()">Fechar</button>
                    </div>
                </div>
            </div>
        `,

    /* ── MAPA DE SALAS ───────────────────────────────────────────── */
    mapaSalas: (rooms) => `
            <div class="view-header">
                <div>
                    <h2>Mapa de Salas</h2>
                    <p>Visualize quais equipamentos estão em cada sala.</p>
                </div>
            </div>
            <div class="filter-bar fade-in">
                <div class="filter-row">
                    <div class="filter-group" style="flex:2;min-width:220px;">
                        <label class="filter-label">Pesquisar</label>
                        <input type="text" id="mapa-salas-search" class="form-control filter-control"
                               placeholder="Nome da pessoa ou número da sala..."
                               oninput="App.modules.mapaSalas.applyFilters()">
                    </div>
                </div>
                <div class="filter-actions">
                    <span id="mapa-salas-result-count" class="filter-count">${rooms.length} sala${rooms.length !== 1 ? "s" : ""}</span>
                    <button class="btn-filter-clear" onclick="const e=document.getElementById('mapa-salas-search');if(e)e.value='';App.modules.mapaSalas.applyFilters()">
                        <i data-lucide="x"></i> Limpar pesquisa
                    </button>
                </div>
            </div>
            <div id="mapa-salas-grid" class="room-map-grid fade-in">
                ${rooms.length === 0 ? `<p id="mapa-salas-empty-state" style="color:var(--text-secondary);grid-column:1/-1;text-align:center;padding:40px;">Nenhuma sala cadastrada.</p>` : ""}
                <p id="mapa-salas-empty-filter" style="display:none;color:var(--text-secondary);grid-column:1/-1;text-align:center;padding:40px;">Nenhuma sala encontrada.</p>
                ${rooms
                  .map(
                    (room) => `
                    <div class="room-map-card room-map-card--clickable" onclick="App.modules.mapaSalas.showRoomDetail('${escapeHtml(room.id)}')"
                         data-search="${escapeHtml([room.name, room.room_number, room.coordinator, ...(room.items || []).map((item) => item.received_by)].filter(Boolean).join(" ").toLowerCase())}"
                         title="Clique para ver todos os equipamentos">
                        <div class="room-map-header">
                            <div class="room-map-header-top">
                                <div>
                                    <h3>${escapeHtml(room.name)}</h3>
                                    ${room.room_number ? `<div class="room-sub">Sala ${escapeHtml(room.room_number)}</div>` : ""}
                                </div>
                                <span class="room-map-count ${room.items.length === 0 ? "empty" : ""}">
                                    ${room.items.length} item${room.items.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                        </div>
                        <div class="room-map-body">
                            ${
                              room.items.length === 0
                                ? `<div class="room-map-empty"><i data-lucide="package-open" style="width:24px;height:24px;opacity:.4;display:block;margin:0 auto 8px;"></i>Sem equipamentos</div>`
                                : (() => {
                                    const preview = room.items.slice(0, 2);
                                    const extra = room.items.length - 2;
                                    return (
                                      preview
                                        .map(
                                          (item) => `
                                        <div class="room-map-item">
                                            <i data-lucide="package" style="width:15px;color:var(--accent-color);flex-shrink:0;"></i>
                                            <div class="room-map-item-info">
                                                <div class="room-map-item-name">${escapeHtml(item.name) || "—"}</div>
                                                <div class="room-map-item-sub">
                                                    ${item.asset_number ? `PAT: ${formatAssetNumber(item.asset_number)}` : ""}
                                                    ${item.asset_number && item.received_by ? " · " : ""}
                                                    ${item.received_by ? `<i data-lucide="user" style="width:10px;vertical-align:middle;"></i> ${escapeHtml(item.received_by)}` : ""}
                                                </div>
                                            </div>
                                        </div>
                                    `,
                                        )
                                        .join("") +
                                      (extra > 0
                                        ? `
                                        <div style="font-size:12px;color:var(--accent-color);font-weight:600;margin-top:6px;text-align:center;">
                                            + ${extra} equipamento${extra !== 1 ? "s" : ""} — clique para ver todos
                                        </div>`
                                        : "")
                                    );
                                  })()
                            }
                        </div>
                        ${
                          room.coordinator || room.description
                            ? `
                            <div class="room-map-footer">
                                ${room.coordinator ? `<i data-lucide="user-check" style="width:13px;flex-shrink:0;"></i> ${escapeHtml(room.coordinator)}` : ""}
                                ${room.coordinator && room.description ? " · " : ""}
                                ${room.description ? escapeHtml(room.description) : ""}
                            </div>
                        `
                            : ""
                        }
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `,

    /* ── SALAS ───────────────────────────────────────────────────── */
    _salasRows: (salas) =>
      salas.length === 0
        ? '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhuma sala cadastrada no sistema.</td></tr>'
        : salas
            .map(
              (sala) => `
                <tr>
                    <td style="color:var(--text-secondary);font-weight:600;">${escapeHtml(sala.room_number) || "—"}</td>
                    <td><strong>${escapeHtml(sala.name)}</strong></td>
                    <td>${escapeHtml(sala.coordinator) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td>${escapeHtml(sala.description) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td><span class="badge-status ${sala.status ? escapeHtml(sala.status.toLowerCase().replace(/\s+/g, "_")) : "ativa"}">${escapeHtml(sala.status) || "Ativa"}</span></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-table-action edit" onclick="App.modules.salas.editRoom('${escapeHtml(sala.id)}')"><i data-lucide="pencil"></i> Editar</button>
                            <button class="btn-table-action delete" onclick="App.modules.salas.deleteRoom(this,'${escapeHtml(sala.id)}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </td>
                </tr>
            `,
            )
            .join(""),

    salas: (salas) => `
            <div class="view-header">
                <div>
                    <h2>Gestão de Salas</h2>
                    <p>Cadastre os ambientes onde os chamados podem ocorrer.</p>
                </div>
                <button class="btn-primary" onclick="App.modules.salas.showCreateModal()"><i data-lucide="plus"></i> Cadastrar Sala</button>
            </div>
            <div class="filter-bar fade-in">
                <div class="filter-row" style="justify-content:flex-end;">
                    <div class="filter-group" style="flex:0;min-width:210px;">
                        <label class="filter-label">Ordenar por</label>
                        <select id="salas-sort" class="form-control filter-control" onchange="App.modules.salas.applySort(this.value)">
                            <option value="nome">Nome (A–Z)</option>
                            <option value="numero">Nº da Sala (crescente)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead><tr>
                        <th>Nº</th>
                        <th>Nome do Local</th>
                        <th>Coordenador</th>
                        <th>Descrição / Setor</th>
                        <th>Status</th>
                        <th style="width:130px;">Ações</th>
                    </tr></thead>
                    <tbody id="salas-tbody">
                        ${Views.app._salasRows(salas)}
                    </tbody>
                </table>
            </div>
        `,

    roomModal: () => `
            <div class="modal-overlay" id="room-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Cadastrar Novo Local</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('room-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-new-room" onsubmit="App.modules.salas.createRoom(event)">
                        <div class="form-group">
                            <label>Nome do Local / Sala <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="room-name" class="form-control" required placeholder="Ex: Sala de Reuniões">
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Número da Sala <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                <input type="text" id="room-number" class="form-control" placeholder="Ex: 101">
                            </div>
                            <div class="form-group">
                                <label>Coordenador <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                <input type="text" id="room-coordinator" class="form-control" placeholder="Ex: João Silva">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Descrição / Setor <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                            <input type="text" id="room-description" class="form-control" placeholder="Ex: Setor Administrativo">
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('room-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Cadastrar</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    salaEditModal: (sala) => `
            <div class="modal-overlay" id="sala-edit-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Editar Local</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('sala-edit-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-edit-sala" onsubmit="App.modules.salas.updateRoom(event,'${escapeHtml(sala.id)}')">
                        <div class="form-group">
                            <label>Nome do Local / Sala <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="edit-room-name" class="form-control" required value="${escapeHtml(sala.name)}">
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Número da Sala <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                <input type="text" id="edit-room-number" class="form-control" value="${escapeHtml(sala.room_number || "")}">
                            </div>
                            <div class="form-group">
                                <label>Coordenador <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                <input type="text" id="edit-room-coordinator" class="form-control" value="${escapeHtml(sala.coordinator || "")}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Descrição / Setor <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                            <input type="text" id="edit-room-description" class="form-control" value="${escapeHtml(sala.description || "")}">
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('sala-edit-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    /* ── USUÁRIOS ────────────────────────────────────────────────── */
    usuarios: (usuarios, currentUserId, currentUserRole) => `
            <div class="view-header">
                <div>
                    <h2>Controle de Usuários</h2>
                    <p>Gerencie os colaboradores e níveis de acesso do sistema.</p>
                </div>
                ${
                  currentUserRole === "admin"
                    ? `
                <button class="btn-primary" onclick="App.modules.usuarios.showCreateModal()">
                    <i data-lucide="user-plus"></i> Novo Usuário
                </button>`
                    : ""
                }
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead><tr>
                        <th>Colaborador</th>
                        <th>E-mail</th>
                        <th>Nível de Acesso</th>
                        <th>Ingresso</th>
                        <th style="width:130px;">Ações</th>
                    </tr></thead>
                    <tbody id="usuarios-tbody">
                        ${usuarios.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum usuário cadastrado.</td></tr>' : ""}
                        ${usuarios
                          .map(
                            (u) => `
                            <tr data-search="${escapeHtml(((u.full_name || "") + " " + (u.email || "")).toLowerCase())}">
                                <td>
                                    <div style="display:flex;align-items:center;gap:10px;">
                                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || "U")}&background=0c4a6e&color=fff&size=32" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;">
                                        <strong>${escapeHtml(u.full_name) || '<span style="color:var(--text-secondary)">Sem nome</span>'}</strong>
                                        ${u.id === currentUserId ? '<span style="background:var(--accent-color);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;margin-left:4px;">Você</span>' : ""}
                                    </div>
                                </td>
                                <td style="color:var(--text-secondary);font-size:13px;">${escapeHtml(u.email) || "—"}</td>
                                <td>
                                    <select class="role-select" onchange="App.modules.usuarios.updateRole('${escapeHtml(u.id)}',this.value)" ${u.id === currentUserId || currentUserRole !== "admin" ? "disabled" : ""}>
                                        <option value="usuario" ${u.role === "usuario" || !u.role ? "selected" : ""}>Usuário</option>
                                        <option value="tecnico" ${u.role === "tecnico" ? "selected" : ""}>Técnico</option>
                                        <option value="admin"   ${u.role === "admin" ? "selected" : ""}>Admin</option>
                                    </select>
                                </td>
                                <td style="color:var(--text-secondary);white-space:nowrap;">${new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                                <td>
                                    <div class="table-actions">
                                        ${currentUserRole === "admin" && u.id !== currentUserId ? `<button class="btn-table-action edit" title="Editar usuário" onclick="App.modules.usuarios.editUsuario('${escapeHtml(u.id)}')"><i data-lucide="pencil"></i></button>` : ""}
                                        ${currentUserRole === "admin" && u.id !== currentUserId ? `<button class="btn-table-action" style="color:var(--warning-color);" title="Enviar email de redefinição de senha" onclick="App.modules.usuarios.resetSenha(this,'${escapeHtml(u.id)}','${escapeHtml(u.full_name || u.email || "")}','${escapeHtml(u.email || "")}')"><i data-lucide="key-round"></i></button>` : ""}
                                        ${currentUserRole === "admin" && u.id !== currentUserId ? `<button class="btn-table-action delete" title="Excluir usuário" onclick="App.modules.usuarios.deleteUsuario(this,'${escapeHtml(u.id)}')"><i data-lucide="trash-2"></i></button>` : ""}
                                    </div>
                                </td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        `,

    usuarioCreateModal: () => `
            <div class="modal-overlay" id="usuario-create-modal">
                <div class="modal-content" style="max-width:440px;">
                    <div class="modal-header">
                        <h3>Novo Usuário</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('usuario-create-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-create-usuario" onsubmit="App.modules.usuarios.createUsuario(event)">
                        <div class="form-group">
                            <label>Nome Completo <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="create-usuario-name" class="form-control" required placeholder="Nome completo do colaborador...">
                        </div>
                        <div class="form-group">
                            <label>E-mail <span style="color:var(--danger-color)">*</span></label>
                            <input type="email" id="create-usuario-email" class="form-control" required placeholder="email@fundepar.pr.gov.br">
                        </div>
                        <div class="form-group">
                            <label>Nível de Acesso</label>
                            <select id="create-usuario-role" class="form-control">
                                <option value="usuario">Usuário</option>
                                <option value="tecnico">Técnico</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div style="background:var(--bg-main);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:8px;">
                            <i data-lucide="lock-keyhole" style="width:15px;height:15px;flex-shrink:0;"></i>
                            Senha inicial: <strong style="color:var(--text-primary);">Fundepar26</strong>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:4px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('usuario-create-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary"><i data-lucide="user-plus"></i> Criar Usuário</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    usuarioEditModal: (u) => `
            <div class="modal-overlay" id="usuario-edit-modal">
                <div class="modal-content" style="max-width:440px;">
                    <div class="modal-header">
                        <h3>Editar Usuário</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('usuario-edit-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-edit-usuario" onsubmit="App.modules.usuarios.updateUsuario(event,'${escapeHtml(u.id)}')">
                        <div class="form-group">
                            <label>Nome Completo <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="edit-usuario-name" class="form-control" value="${escapeHtml(u.full_name || "")}" required placeholder="Nome completo...">
                        </div>
                        <div class="form-group">
                            <label>E-mail <span style="color:var(--danger-color)">*</span></label>
                            <input type="email" id="edit-usuario-email" class="form-control" value="${escapeHtml(u.email || "")}" required placeholder="email@exemplo.com">
                            <small style="color:var(--text-secondary);font-size:11px;display:block;margin-top:4px;">Altera apenas o e-mail de exibição no sistema.</small>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('usuario-edit-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    perfilPage: (user) => `
            <div class="view-header">
                <div>
                    <h2>Meu Perfil</h2>
                    <p>Gerencie suas informações pessoais e segurança da conta.</p>
                </div>
            </div>
            <div class="profile-page-grid fade-in">
                <div class="profile-avatar-card">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || "U")}&background=0c4a6e&color=fff&size=96" class="avatar-lg">
                    <h3>${escapeHtml(user.full_name) || "Usuário"}</h3>
                    <span class="badge-role-pill ${escapeHtml(user.role || "usuario")}">${escapeHtml(user.role) || "usuário"}</span>
                    <p style="font-size:13px;color:var(--text-secondary);margin-top:8px;word-break:break-all;">${escapeHtml(user.email)}</p>
                </div>
                <div style="display:flex;flex-direction:column;gap:20px;">
                    <div class="table-card">
                        <h4 style="font-size:16px;font-weight:700;color:var(--primary-color);margin-bottom:20px;display:flex;align-items:center;gap:8px;"><i data-lucide="user" style="width:17px;"></i> Dados Pessoais</h4>
                        <form id="form-perfil-nome" onsubmit="App.modules.perfil.updateName(event)">
                            <div class="form-group">
                                <label>Nome Completo</label>
                                <input type="text" id="perfil-name" class="form-control" value="${escapeHtml(user.full_name || "")}" required>
                            </div>
                            <div class="form-group">
                                <label>E-mail</label>
                                <input type="email" class="form-control" readonly value="${escapeHtml(user.email)}">
                            </div>
                            <button type="submit" class="btn-primary">Salvar Nome</button>
                        </form>
                    </div>
                    <div class="table-card">
                        <h4 style="font-size:16px;font-weight:700;color:var(--primary-color);margin-bottom:20px;display:flex;align-items:center;gap:8px;"><i data-lucide="lock" style="width:17px;"></i> Alterar Senha</h4>
                        <form id="form-perfil-senha" onsubmit="App.modules.perfil.updatePassword(event)">
                            <div class="form-group">
                                <label>Nova Senha <span style="color:var(--danger-color)">*</span></label>
                                <input type="password" id="perfil-new-pass" class="form-control" minlength="6" placeholder="Mínimo 6 caracteres" required>
                            </div>
                            <div class="form-group">
                                <label>Confirmar Senha <span style="color:var(--danger-color)">*</span></label>
                                <input type="password" id="perfil-confirm-pass" class="form-control" placeholder="Repita a nova senha" required>
                            </div>
                            <button type="submit" class="btn-primary" style="background:var(--primary-color);">Alterar Senha</button>
                        </form>
                    </div>
                </div>
            </div>
        `,

    /* ── WORKFLOW (KANBAN) ───────────────────────────────────────── */
    workflow: (tickets) => {
      const cols = {
        aberto: tickets.filter((t) => t.status === "aberto"),
        em_progresso: tickets.filter((t) => t.status === "em_progresso"),
        resolvido: tickets.filter((t) => t.status === "resolvido"),
      };
      const renderCard = (ticket) => `
                <div class="kanban-card" draggable="true"
                    data-ticket-id="${escapeHtml(ticket.id)}"
                    ondragstart="App.modules.workflow.dragStart(event)"
                    ondragend="App.modules.workflow.dragEnd()"
                    onclick="App.modules.workflow.showDetailModal(this.dataset.ticketId)">
                    <h4>${escapeHtml(ticket.title)}</h4>
                    <p>${escapeHtml(ticket.description)}</p>
                    <div class="kanban-card-meta">
                        <span class="badge-status ${escapeHtml(ticket.priority)}">${escapeHtml(ticket.priority)}</span>
                        <span style="color:var(--text-secondary);display:flex;align-items:center;gap:4px;">
                            <i data-lucide="map-pin" style="width:12px"></i> ${ticket.rooms ? escapeHtml(ticket.rooms.name) : "Sem local"}
                        </span>
                    </div>
                </div>
            `;
      return `
                <div class="view-header">
                    <div>
                        <h2>Painel Kanban (Workflow)</h2>
                        <p>Desktop: arraste os cartões. Mobile: toque para ver detalhes e mover.</p>
                    </div>
                    <button class="btn-primary" onclick="App.modules.workflow.showCreateModal()"><i data-lucide="plus"></i> Abrir Chamado</button>
                </div>
                <div class="kanban-tabs">
                    <button class="kanban-tab" data-tab="aberto"       onclick="App.modules.workflow.switchTab('aberto')">Abertos <span style="opacity:.7">(${cols.aberto.length})</span></button>
                    <button class="kanban-tab" data-tab="em_progresso" onclick="App.modules.workflow.switchTab('em_progresso')">Em Prog. <span style="opacity:.7">(${cols.em_progresso.length})</span></button>
                    <button class="kanban-tab" data-tab="resolvido"    onclick="App.modules.workflow.switchTab('resolvido')">Resolvidos <span style="opacity:.7">(${cols.resolvido.length})</span></button>
                </div>
                <div class="kanban-board fade-in">
                    <div class="kanban-column" data-status="aberto" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event)">
                        <div class="kanban-header"><span style="display:flex;align-items:center;gap:8px;"><i data-lucide="alert-circle" style="width:18px"></i> Abertos</span><span class="count">${cols.aberto.length}</span></div>
                        <div class="kanban-cards">${cols.aberto.map(renderCard).join("") || '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px 0;">Nenhum chamado</p>'}</div>
                    </div>
                    <div class="kanban-column" data-status="em_progresso" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event)">
                        <div class="kanban-header" style="color:var(--warning-color);"><span style="display:flex;align-items:center;gap:8px;"><i data-lucide="loader-2" style="width:18px"></i> Em Progresso</span><span class="count">${cols.em_progresso.length}</span></div>
                        <div class="kanban-cards">${cols.em_progresso.map(renderCard).join("") || '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px 0;">Nenhum chamado</p>'}</div>
                    </div>
                    <div class="kanban-column" data-status="resolvido" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event)">
                        <div class="kanban-header" style="color:var(--success-color);"><span style="display:flex;align-items:center;gap:8px;"><i data-lucide="check-circle" style="width:18px"></i> Resolvidos</span><span class="count">${cols.resolvido.length}</span></div>
                        <div class="kanban-cards">${cols.resolvido.map(renderCard).join("") || '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px 0;">Nenhum chamado</p>'}</div>
                    </div>
                </div>
            `;
    },

    ticketModal: (rooms) => `
            <div class="modal-overlay" id="ticket-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Solicitação de Atendimento</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('ticket-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-new-ticket" onsubmit="App.modules.workflow.createTicket(event)">
                        <div class="form-group">
                            <label>Título / Resumo do Problema</label>
                            <input type="text" id="ticket-title" class="form-control" required placeholder="Ex: Projetor não liga">
                        </div>
                        <div class="form-group">
                            <label>Descrição Completa</label>
                            <textarea id="ticket-desc" class="form-control" required rows="4" placeholder="Detalhe o que está acontecendo..."></textarea>
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Local afetado</label>
                                <select id="ticket-room" class="form-control" required>
                                    <option value="" disabled selected>Selecione a sala...</option>
                                    ${rooms.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("")}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Nível de Prioridade</label>
                                <select id="ticket-priority" class="form-control">
                                    <option value="baixa">Baixa</option>
                                    <option value="media" selected>Média</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('ticket-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Enviar Solicitação</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    ticketDetailModal: (ticket) => {
      const statusLabels = {
        aberto: "Aberto",
        em_progresso: "Em Progresso",
        resolvido: "Resolvido",
      };
      const otherStatuses = ["aberto", "em_progresso", "resolvido"].filter(
        (s) => s !== ticket.status,
      );
      const moveIcons = {
        aberto: "alert-circle",
        em_progresso: "loader-2",
        resolvido: "check-circle",
      };
      const moveLabels = {
        aberto: "Aberto",
        em_progresso: "Em Progresso",
        resolvido: "Resolvido",
      };
      return `
                <div class="modal-overlay" id="ticket-detail-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span class="badge-status ${escapeHtml(ticket.priority)}">${escapeHtml(ticket.priority)}</span>
                                <span class="badge-status ${escapeHtml(ticket.status)}">${escapeHtml(statusLabels[ticket.status] || ticket.status)}</span>
                            </div>
                            <button class="modal-close" type="button" onclick="document.getElementById('ticket-detail-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                        <h3 style="font-size:18px;color:var(--primary-color);margin-bottom:12px;font-weight:700;">${escapeHtml(ticket.title)}</h3>
                        <p style="color:var(--text-secondary);font-size:14px;line-height:1.6;margin-bottom:24px;white-space:pre-wrap;">${escapeHtml(ticket.description)}</p>
                        <div class="detail-meta-grid">
                            <div class="detail-meta-item"><span class="detail-meta-label">Local</span><span>${ticket.rooms ? escapeHtml(ticket.rooms.name) : "—"}</span></div>
                            <div class="detail-meta-item"><span class="detail-meta-label">Solicitante</span><span>${ticket.profiles ? escapeHtml(ticket.profiles.full_name) || "—" : "—"}</span></div>
                            <div class="detail-meta-item"><span class="detail-meta-label">Aberto em</span><span>${new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span></div>
                        </div>
                        <div style="border-top:1px solid var(--border-color);padding-top:20px;">
                            ${
                              otherStatuses.length > 0
                                ? `
                                <div style="font-size:12px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;margin-bottom:10px;letter-spacing:.5px;">Mover para</div>
                                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
                                    ${otherStatuses.map((s) => `<button class="btn-move-status" onclick="App.modules.workflow.moveTicket('${escapeHtml(ticket.id)}','${s}')"><i data-lucide="${moveIcons[s]}"></i> ${moveLabels[s]}</button>`).join("")}
                                </div>
                            `
                                : ""
                            }
                            ${
                              Auth.user?.role === "admin" ||
                              Auth.user?.role === "tecnico" ||
                              ticket.requester_id === Auth.user?.id
                                ? `
                            <button id="btn-delete-ticket" class="btn-danger" onclick="App.modules.workflow.deleteTicket('${escapeHtml(ticket.id)}')">
                                <i data-lucide="trash-2"></i> Excluir Chamado
                            </button>`
                                : ""
                            }
                        </div>
                    </div>
                </div>
            `;
    },

    /* ── SALA DETAIL MODAL ───────────────────────────────────────── */
    salaDetailModal: (room) => `
            <div class="modal-overlay" id="sala-detail-modal">
                <div class="modal-content" style="max-width:700px;">
                    <div class="modal-header">
                        <div>
                            <h3>${escapeHtml(room.name)}</h3>
                            ${room.room_number ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">Sala ${escapeHtml(room.room_number)}</div>` : ""}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <button class="btn-primary" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-color);padding:7px 12px;"
                                    onclick="App.modules.mapaSalas.exportExcel('${escapeHtml(room.id)}')">
                                <i data-lucide="file-spreadsheet"></i> Exportar Excel
                            </button>
                            <button class="modal-close" type="button" onclick="document.getElementById('sala-detail-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                    </div>
                    ${
                      room.coordinator || room.description
                        ? `
                    <div style="display:flex;gap:16px;flex-wrap:wrap;padding:12px 0 16px;border-bottom:1px solid var(--border-color);margin-bottom:16px;">
                        ${room.coordinator ? `<span style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);"><i data-lucide="user-check" style="width:14px;"></i> ${escapeHtml(room.coordinator)}</span>` : ""}
                        ${room.description ? `<span style="font-size:13px;color:var(--text-secondary);">${escapeHtml(room.description)}</span>` : ""}
                    </div>`
                        : ""
                    }
                    <table class="data-table">
                        <thead><tr>
                            <th>Equipamento</th>
                            <th>Nº Patrimônio</th>
                            <th>Nº Série</th>
                            <th>Recebedor</th>
                            <th>Última Movimentação</th>
                        </tr></thead>
                        <tbody>
                            ${
                              room.items.length === 0
                                ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum equipamento nesta sala no momento.</td></tr>`
                                : room.items
                                    .map(
                                      (item) => `
                                    <tr>
                                        <td><strong>${escapeHtml(item.name)}</strong></td>
                                        <td>${formatAssetNumber(item.asset_number) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                                        <td style="color:var(--text-secondary);">${escapeHtml(item.serial_number) || "—"}</td>
                                        <td>${escapeHtml(item.received_by) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                                        <td style="color:var(--text-secondary);white-space:nowrap;">
                                            ${
                                              item.moved_at
                                                ? `${new Date(item.moved_at).toLocaleDateString("pt-BR")} <span style="font-size:12px;opacity:.7">${new Date(item.moved_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>`
                                                : "—"
                                            }
                                        </td>
                                    </tr>`,
                                    )
                                    .join("")
                            }
                        </tbody>
                    </table>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;">
                        <span style="font-size:13px;color:var(--text-secondary);">${room.items.length} equipamento${room.items.length !== 1 ? "s" : ""} encontrado${room.items.length !== 1 ? "s" : ""}</span>
                        <button class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('sala-detail-modal').remove()">Fechar</button>
                    </div>
                </div>
            </div>
        `,

    /* ── MOVIMENTAÇÃO EDIT MODAL ─────────────────────────────────── */
    movimentacaoEditModal: (movement, rooms) => `
            <div class="modal-overlay" id="movimentacao-edit-modal">
                <div class="modal-content" style="max-width:580px;">
                    <div class="modal-header">
                        <h3>Editar Movimentação</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('movimentacao-edit-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-edit-movimentacao" onsubmit="App.modules.movimentacoes.update(event, '${escapeHtml(movement.id)}')">
                        <div class="form-group">
                            <label>Equipamento</label>
                            <input type="text" class="form-control" readonly value="${movement.equipment ? escapeHtml(movement.equipment.name) : "—"}">
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Nº de Série</label>
                                <input type="text" id="edit-mov-serial" class="form-control" value="${escapeHtml(movement.serial_number || "")}" placeholder="Ex: SN123456789">
                            </div>
                            <div class="form-group">
                                <label>Nº Patrimônio</label>
                                <input type="text" id="edit-mov-asset" class="form-control" value="${formatAssetNumber(movement.asset_number)}" placeholder="Ex: 000.000.000.000" oninput="maskAssetNumber(event)">
                            </div>
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Origem <span style="color:var(--danger-color)">*</span></label>
                                <input type="hidden" id="edit-mov-origin-id" value="${escapeHtml(movement.origin_room_id || "")}">
                                <div class="autocomplete-wrapper" id="wrap-edit-origin">
                                    <input type="text" id="edit-mov-origin" class="form-control" required autocomplete="off"
                                           value="${movement.origin ? escapeHtml(movement.origin.name) : ""}"
                                           placeholder="Toque para ver as salas..."
                                           onfocus="Autocomplete.show('wrap-edit-origin')"
                                           onblur="Autocomplete.hide('wrap-edit-origin')"
                                           oninput="Autocomplete.filter('wrap-edit-origin')">
                                    <div class="autocomplete-list" id="wrap-edit-origin-list">
                                        ${rooms.map((r) => `<div class="autocomplete-item" data-label="${escapeHtml(r.name)}" onpointerdown="event.preventDefault();Autocomplete.pick('wrap-edit-origin','${escapeHtml(r.id)}','${escapeHtml(r.name)}','edit-mov-origin-id')">${escapeHtml(r.name)}</div>`).join("")}
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Destino <span style="color:var(--danger-color)">*</span></label>
                                <input type="hidden" id="edit-mov-destination-id" value="${escapeHtml(movement.destination_room_id || "")}">
                                <div class="autocomplete-wrapper" id="wrap-edit-dest">
                                    <input type="text" id="edit-mov-destination" class="form-control" required autocomplete="off"
                                           value="${movement.destination ? escapeHtml(movement.destination.name) : ""}"
                                           placeholder="Toque para ver as salas..."
                                           onfocus="Autocomplete.show('wrap-edit-dest')"
                                           onblur="Autocomplete.hide('wrap-edit-dest')"
                                           oninput="Autocomplete.filter('wrap-edit-dest')">
                                    <div class="autocomplete-list" id="wrap-edit-dest-list">
                                        ${rooms.map((r) => `<div class="autocomplete-item" data-label="${escapeHtml(r.name)}" onpointerdown="event.preventDefault();Autocomplete.pick('wrap-edit-dest','${escapeHtml(r.id)}','${escapeHtml(r.name)}','edit-mov-destination-id')">${escapeHtml(r.name)}</div>`).join("")}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-2col">
                            <div class="form-group">
                                <label>Recebedor</label>
                                <input type="text" id="edit-mov-received-by" class="form-control" value="${escapeHtml(movement.received_by || "")}" placeholder="Nome de quem recebe...">
                            </div>
                            <div class="form-group">
                                <label>Data / Hora <span style="color:var(--danger-color)">*</span></label>
                                <input type="datetime-local" id="edit-mov-date" class="form-control" required
                                       value="${(() => {
                                         if (!movement.moved_at) return "";
                                         const d = new Date(movement.moved_at);
                                         const p = (n) =>
                                           String(n).padStart(2, "0");
                                         return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
                                       })()}">
                            </div>
                        </div>
                        <div class="form-group edit-reason-group">
                            <label style="display:flex;align-items:center;gap:6px;">
                                <i data-lucide="message-square" style="width:15px;color:var(--warning-color);"></i>
                                Justificativa da edição <span style="color:var(--danger-color)">*</span>
                            </label>
                            <textarea id="edit-mov-reason" class="form-control" rows="3" required
                                      placeholder="Descreva o motivo da edição desta movimentação..."></textarea>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:8px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('movimentacao-edit-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

    /* ── MOVIMENTAÇÃO EDIT INFO MODAL ────────────────────────────── */
    movimentacaoEditInfoModal: (logs) => `
            <div class="modal-overlay" id="edit-info-modal">
                <div class="modal-content" style="max-width:480px;">
                    <div class="modal-header">
                        <h3 style="display:flex;align-items:center;gap:8px;">
                            <i data-lucide="history" style="width:18px;color:var(--warning-color);"></i>
                            Histórico de Edições
                            <span style="background:var(--bg-hover);color:var(--text-secondary);font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;">${logs.length}</span>
                        </h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('edit-info-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <div style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:4px 0 8px;">
                        ${
                          logs.length === 0
                            ? `<p style="text-align:center;color:var(--text-secondary);padding:28px 0;">Nenhum registro de edição encontrado.</p>`
                            : logs
                                .map(
                                  (log) => `
                                <div class="edit-log-entry">
                                    <div class="edit-log-header">
                                        <span class="edit-log-who"><i data-lucide="user" style="width:12px;"></i> ${escapeHtml(log.editor_name)}</span>
                                        <span class="edit-log-when">${new Date(log.edited_at).toLocaleDateString("pt-BR")} às ${new Date(log.edited_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                    <div class="edit-info-reason">${escapeHtml(log.edit_reason)}</div>
                                </div>
                            `,
                                )
                                .join("")
                        }
                    </div>
                    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
                        <button class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('edit-info-modal').remove()">Fechar</button>
                    </div>
                </div>
            </div>
        `,

    /* ── NOTIFICATIONS PANEL ─────────────────────────────────────── */
    notificationsPanel: (items) => `
            <div class="notif-header">
                <h4>Notificações</h4>
                <button class="btn-icon" style="width:30px;height:30px;" onclick="App.notifications.close()"><i data-lucide="x"></i></button>
            </div>
            <div class="notif-list">
                ${
                  items.length === 0
                    ? `<div class="notif-empty"><i data-lucide="bell-off" style="width:32px;height:32px;opacity:.3;display:block;margin:0 auto 12px;"></i>Nenhuma atividade ainda.</div>`
                    : items
                        .map((item) => {
                          const lastSeen = localStorage.getItem(
                            "notif_last_seen",
                          )
                            ? new Date(localStorage.getItem("notif_last_seen"))
                            : null;
                          const isNew = !lastSeen || item.date > lastSeen;
                          return `
                        <div class="notif-item${isNew ? " unread" : ""}">
                            <div class="notif-icon ${item.type}">
                                <i data-lucide="${item.type === "movement" ? "arrow-right-left" : "package"}" style="width:15px;"></i>
                            </div>
                            <div class="notif-body">
                                <div class="notif-msg"><strong>${escapeHtml(item.actor)}</strong> ${item.text}</div>
                                <div class="notif-time">${App.notifications._relativeTime(item.date)}</div>
                                <span class="notif-detail-btn" onclick="App.notifications.showDetail('${escapeHtml(item.id)}')">
                                    <i data-lucide="eye" style="width:12px;"></i> Ver detalhes
                                </span>
                            </div>
                        </div>`;
                        })
                        .join("")
                }
            </div>
        `,

    /* ── SCANNER ─────────────────────────────────────────────────── */
    scannerModal: () => `
            <div class="modal-overlay" id="scanner-modal">
                <div class="modal-content" style="max-width:400px;">
                    <div class="modal-header">
                        <div>
                            <h3>Escanear Patrimônio</h3>
                            <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">Aponte a câmera para o código de barras</div>
                        </div>
                        <button class="modal-close" type="button" onclick="App.scanner.close()"><i data-lucide="x"></i></button>
                    </div>
                    <div class="scanner-viewport">
                        <video id="scanner-video" autoplay playsinline muted></video>
                        <div class="scanner-overlay">
                            <div class="scanner-frame">
                                <div class="scanner-line"></div>
                            </div>
                        </div>
                    </div>
                    <p style="font-size:12px;color:var(--text-secondary);text-align:center;margin:0 0 14px;">
                        Posicione o código de barras dentro da área marcada
                    </p>
                    <button class="btn-primary" style="background:#e2e8f0;color:#475569;width:100%;" onclick="App.scanner.close()">
                        <i data-lucide="x"></i> Cancelar
                    </button>
                </div>
            </div>
        `,

    scanResultModal: (m, assetNumber) => `
            <div class="modal-overlay" id="scan-result-modal">
                <div class="modal-content" style="max-width:460px;">
                    <div class="modal-header">
                        <div>
                            <h3>Máquina Localizada</h3>
                            <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">PAT: <strong>${escapeHtml(formatAssetNumber(assetNumber))}</strong></div>
                        </div>
                        <button class="modal-close" type="button" onclick="document.getElementById('scan-result-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:14px;margin-top:4px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="background:rgba(99,102,241,.1);color:#6366f1;padding:12px;border-radius:10px;flex-shrink:0;"><i data-lucide="package" style="width:22px;"></i></div>
                            <div>
                                <div style="font-size:16px;font-weight:700;">${escapeHtml(m.equipment?.name || "—")}</div>
                                ${m.serial_number ? `<div style="font-size:12px;color:var(--text-secondary);">Série: ${escapeHtml(m.serial_number)}</div>` : ""}
                            </div>
                        </div>
                        <div style="background:rgba(12,74,110,.07);border:1.5px solid var(--accent-color);border-radius:12px;padding:16px;">
                            <div style="font-size:11px;color:var(--accent-color);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Localização atual</div>
                            <div style="display:flex;align-items:center;gap:8px;font-size:17px;font-weight:800;color:var(--accent-color);">
                                <i data-lucide="map-pin" style="width:18px;flex-shrink:0;"></i>
                                ${escapeHtml(m.destination_room?.name || "—")}
                            </div>
                            ${m.profile ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:8px;display:flex;align-items:center;gap:5px;"><i data-lucide="user" style="width:13px;"></i> Responsável: ${escapeHtml(m.profile.full_name)}</div>` : ""}
                            ${m.received_by ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;display:flex;align-items:center;gap:5px;"><i data-lucide="user-check" style="width:13px;"></i> Com: ${escapeHtml(m.received_by)}</div>` : ""}
                            <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;opacity:.7;">
                                Última movimentação: ${new Date(m.moved_at).toLocaleDateString("pt-BR")}
                            </div>
                        </div>
                        <div style="background:var(--bg-main);border-radius:10px;padding:14px;text-align:center;">
                            <div style="font-size:14px;font-weight:600;color:var(--text-primary);">Deseja registrar uma movimentação?</div>
                            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">A origem será preenchida automaticamente com a sala atual.</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:10px;margin-top:20px;">
                        <button class="btn-primary" style="background:#e2e8f0;color:#475569;flex:1;" onclick="document.getElementById('scan-result-modal').remove()">Fechar</button>
                        <button class="btn-primary" style="flex:1;" onclick="document.getElementById('scan-result-modal').remove();App.modules.movimentacoes.showCreateModal('${escapeHtml(formatAssetNumber(assetNumber))}','${escapeHtml(m.destination_room?.id || "")}','${escapeHtml(m.destination_room?.name || "")}')">
                            <i data-lucide="arrow-right-left"></i> Registrar Movimentação
                        </button>
                    </div>
                </div>
            </div>
        `,

    notificationDetailModal: (item) => {
      const m = item.data;
      if (item.type === "movement") {
        return `
                <div class="modal-overlay" id="notif-detail-modal">
                    <div class="modal-content" style="max-width:480px;">
                        <div class="modal-header">
                            <div>
                                <h3>Detalhes da Movimentação</h3>
                                <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">${new Date(m.moved_at).toLocaleString("pt-BR")}</div>
                            </div>
                            <button class="modal-close" type="button" onclick="document.getElementById('notif-detail-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:14px;margin-top:4px;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <div style="background:rgba(99,102,241,.1);color:#6366f1;padding:10px;border-radius:10px;"><i data-lucide="package" style="width:20px;"></i></div>
                                <div>
                                    <div style="font-size:12px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.4px;">Equipamento</div>
                                    <div style="font-size:15px;font-weight:700;">${escapeHtml(m.equipment?.name || "—")}</div>
                                    ${m.asset_number ? `<div style="font-size:12px;color:var(--text-secondary);">PAT: ${formatAssetNumber(m.asset_number)}</div>` : ""}
                                    ${m.serial_number ? `<div style="font-size:12px;color:var(--text-secondary);">Série: ${escapeHtml(m.serial_number)}</div>` : ""}
                                </div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:center;gap:8px;background:var(--bg-main);border-radius:10px;padding:14px;">
                                <div>
                                    <div style="font-size:11px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">Origem</div>
                                    <div style="font-size:14px;font-weight:600;display:flex;align-items:center;gap:5px;"><i data-lucide="map-pin" style="width:13px;color:var(--text-secondary);"></i>${escapeHtml(m.origin_room?.name || "—")}</div>
                                </div>
                                <div style="text-align:center;color:var(--accent-color);"><i data-lucide="arrow-right" style="width:18px;"></i></div>
                                <div>
                                    <div style="font-size:11px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">Destino</div>
                                    <div style="font-size:14px;font-weight:700;color:var(--accent-color);display:flex;align-items:center;gap:5px;"><i data-lucide="map-pin" style="width:13px;"></i>${escapeHtml(m.destination_room?.name || "—")}</div>
                                </div>
                            </div>
                            <div style="display:flex;gap:16px;flex-wrap:wrap;">
                                <div style="flex:1;min-width:130px;">
                                    <div style="font-size:11px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;">Responsável</div>
                                    <div style="font-size:14px;">${escapeHtml(item.actor)}</div>
                                </div>
                                ${
                                  m.received_by
                                    ? `
                                <div style="flex:1;min-width:130px;">
                                    <div style="font-size:11px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;">Recebedor</div>
                                    <div style="font-size:14px;">${escapeHtml(m.received_by)}</div>
                                </div>`
                                    : ""
                                }
                            </div>
                        </div>
                        <div style="display:flex;justify-content:flex-end;margin-top:24px;">
                            <button class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('notif-detail-modal').remove()">Fechar</button>
                        </div>
                    </div>
                </div>`;
      } else {
        return `
                <div class="modal-overlay" id="notif-detail-modal">
                    <div class="modal-content" style="max-width:420px;">
                        <div class="modal-header">
                            <div>
                                <h3>Equipamento Cadastrado</h3>
                                <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">${new Date(m.created_at).toLocaleString("pt-BR")}</div>
                            </div>
                            <button class="modal-close" type="button" onclick="document.getElementById('notif-detail-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                        <div style="display:flex;align-items:center;gap:14px;background:var(--bg-main);border-radius:10px;padding:16px;margin-top:8px;">
                            <div style="background:rgba(99,102,241,.1);color:#6366f1;padding:12px;border-radius:10px;flex-shrink:0;"><i data-lucide="package" style="width:24px;"></i></div>
                            <div>
                                <div style="font-size:16px;font-weight:700;">${escapeHtml(m.name)}</div>
                                <div style="font-size:13px;color:var(--text-secondary);margin-top:3px;">Cadastrado por <strong>${escapeHtml(item.actor)}</strong></div>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:flex-end;margin-top:24px;">
                            <button class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('notif-detail-modal').remove()">Fechar</button>
                        </div>
                    </div>
                </div>`;
      }
    },
  },
};
