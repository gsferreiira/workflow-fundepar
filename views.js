// views.js

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
        `
    },

    app: {
        /* ── DASHBOARD ───────────────────────────────────────────────── */
        dashboard: (stats) => `
            <div class="view-header">
                <div>
                    <h2>Olá, ${escapeHtml(Auth.user.full_name) || 'Usuário'}</h2>
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
        `,

        /* ── EQUIPAMENTOS ────────────────────────────────────────────── */
        equipamentos: (equipamentos) => `
            <div class="view-header">
                <div>
                    <h2>Equipamentos</h2>
                    <p>Cadastre os equipamentos que poderão ser movimentados.</p>
                </div>
                <button class="btn-primary" onclick="App.modules.equipamentos.showCreateModal()"><i data-lucide="plus"></i> Cadastrar Equipamento</button>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead><tr>
                        <th>Nome do Equipamento</th>
                        <th>Cadastrado em</th>
                        <th style="width:130px;">Ações</th>
                    </tr></thead>
                    <tbody>
                        ${equipamentos.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum equipamento cadastrado.</td></tr>' : ''}
                        ${equipamentos.map(eq => `
                            <tr>
                                <td><strong>${escapeHtml(eq.name)}</strong></td>
                                <td style="color:var(--text-secondary);">${new Date(eq.created_at).toLocaleDateString('pt-BR')}</td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn-table-action edit" onclick="App.modules.equipamentos.editEquipamento('${escapeHtml(eq.id)}')"><i data-lucide="pencil"></i> Editar</button>
                                        <button class="btn-table-action delete" onclick="App.modules.equipamentos.deleteEquipamento(this,'${escapeHtml(eq.id)}')"><i data-lucide="trash-2"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,

        equipamentoModal: () => `
            <div class="modal-overlay" id="equipamento-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Cadastrar Equipamento</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('equipamento-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-new-equipamento" onsubmit="App.modules.equipamentos.create(event)">
                        <div class="form-group">
                            <label>Nome do Equipamento <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="equip-name" class="form-control" required placeholder="Ex: Notebook Dell Latitude 5520">
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('equipamento-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Cadastrar</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        equipamentoEditModal: (eq) => `
            <div class="modal-overlay" id="equipamento-edit-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Editar Equipamento</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('equipamento-edit-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form id="form-edit-equipamento" onsubmit="App.modules.equipamentos.updateEquipamento(event,'${escapeHtml(eq.id)}')">
                        <div class="form-group">
                            <label>Nome do Equipamento <span style="color:var(--danger-color)">*</span></label>
                            <input type="text" id="edit-equip-name" class="form-control" required value="${escapeHtml(eq.name)}">
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;">
                            <button type="button" class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('equipamento-edit-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        /* ── MOVIMENTAÇÕES ───────────────────────────────────────────── */
        movimentacoes: (movimentacoes) => `
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
                    <button class="btn-primary" onclick="App.modules.movimentacoes.showCreateModal()"><i data-lucide="plus"></i> Registrar Movimentação</button>
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
                    <tbody>
                        ${movimentacoes.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhuma movimentação registrada.</td></tr>' : ''}
                        ${movimentacoes.map(m => `
                            <tr>
                                <td><strong>${m.equipment ? escapeHtml(m.equipment.name) : '—'}</strong></td>
                                <td style="color:var(--text-secondary)">${escapeHtml(m.serial_number) || '—'}</td>
                                <td style="color:var(--text-secondary)">${escapeHtml(m.asset_number) || '—'}</td>
                                <td>
                                    <span style="display:flex;align-items:center;gap:4px;color:var(--text-secondary)">
                                        <i data-lucide="map-pin" style="width:12px;flex-shrink:0"></i>
                                        ${m.origin ? escapeHtml(m.origin.name) : '—'}
                                    </span>
                                </td>
                                <td>
                                    <span style="display:flex;align-items:center;gap:4px;color:var(--accent-color)">
                                        <i data-lucide="map-pin" style="width:12px;flex-shrink:0"></i>
                                        ${m.destination ? escapeHtml(m.destination.name) : '—'}
                                    </span>
                                </td>
                                <td>${m.profiles ? escapeHtml(m.profiles.full_name) : '—'}</td>
                                <td>${escapeHtml(m.received_by) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                                <td style="color:var(--text-secondary);white-space:nowrap;">
                                    ${new Date(m.moved_at).toLocaleDateString('pt-BR')}
                                    <span style="font-size:12px;opacity:.7"> ${new Date(m.moved_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                                </td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                                        <button class="btn-table-action edit" title="Editar" onclick="App.modules.movimentacoes.showEditModal('${escapeHtml(m.id)}')"><i data-lucide="pencil"></i></button>
                                        <button class="btn-table-action delete" title="Excluir" onclick="App.modules.movimentacoes.delete(this,'${escapeHtml(m.id)}')"><i data-lucide="trash-2"></i></button>
                                        ${m.is_edited ? `<button class="badge-edited" onclick="App.modules.movimentacoes.showEditInfo('${escapeHtml(m.id)}')" title="Ver histórico de edições"><i data-lucide="history"></i> Editado</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,

        movimentacaoModal: (equipment, rooms) => {
            const now = new Date();
            return `
                <div class="modal-overlay" id="movimentacao-modal">
                    <div class="modal-content" style="max-width:580px;">
                        <div class="modal-header">
                            <h3>Registrar Movimentação</h3>
                            <button class="modal-close" type="button" onclick="document.getElementById('movimentacao-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                        <form id="form-new-movimentacao" onsubmit="App.modules.movimentacoes.create(event)">
                            <input type="hidden" id="mov-equipment-id">

                            <div class="form-group">
                                <label>Equipamento <span style="color:var(--danger-color)">*</span></label>
                                <input type="text" id="mov-equipment-name" class="form-control" list="equipment-datalist" required
                                       placeholder="Digite ou selecione o equipamento..." autocomplete="off"
                                       oninput="App.modules.movimentacoes.fillEquipmentData(this.value)">
                                <datalist id="equipment-datalist">
                                    ${equipment.map(e => `<option value="${escapeHtml(e.name)}"></option>`).join('')}
                                </datalist>
                                ${equipment.length === 0 ? `<p style="color:var(--warning-color);font-size:12px;margin-top:6px;"><i>Nenhum equipamento cadastrado. <a href="#equipamentos" style="color:var(--accent-color)" onclick="document.getElementById('movimentacao-modal').remove()">Cadastre primeiro →</a></i></p>` : ''}
                            </div>

                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                                <div class="form-group">
                                    <label>Nº de Série <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                    <input type="text" id="mov-serial" class="form-control" placeholder="Ex: SN123456789">
                                </div>
                                <div class="form-group">
                                    <label>Nº Patrimônio <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                    <input type="text" id="mov-asset-number" class="form-control" placeholder="Ex: PAT-00123">
                                </div>
                            </div>

                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                                <div class="form-group">
                                    <label>Origem <span style="color:var(--danger-color)">*</span></label>
                                    <input type="text" id="mov-origin" class="form-control" list="rooms-datalist-origin" required
                                           placeholder="Local de origem..." autocomplete="off">
                                    <datalist id="rooms-datalist-origin">
                                        ${rooms.map(r => `<option value="${escapeHtml(r.name)}"></option>`).join('')}
                                    </datalist>
                                </div>
                                <div class="form-group">
                                    <label>Destino <span style="color:var(--danger-color)">*</span></label>
                                    <input type="text" id="mov-destination" class="form-control" list="rooms-datalist-dest" required
                                           placeholder="Local de destino..." autocomplete="off">
                                    <datalist id="rooms-datalist-dest">
                                        ${rooms.map(r => `<option value="${escapeHtml(r.name)}"></option>`).join('')}
                                    </datalist>
                                </div>
                            </div>

                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                                <div class="form-group">
                                    <label>Responsável pela Movimentação</label>
                                    <input type="text" class="form-control" readonly value="${escapeHtml(Auth.user.full_name || Auth.user.email)}">
                                </div>
                                <div class="form-group">
                                    <label>Recebedor <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                    <input type="text" id="mov-received-by" class="form-control" placeholder="Nome de quem recebe...">
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Data / Hora</label>
                                <input type="text" class="form-control" readonly value="${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}">
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
        rastreio: (data) => `
            <div class="view-header">
                <div>
                    <h2>Rastreio de Patrimônio</h2>
                    <p>Localização atual de cada equipamento com base na última movimentação.</p>
                </div>
            </div>
            <div class="table-card fade-in">
                <div class="search-inline">
                    <i data-lucide="search"></i>
                    <input type="text" id="rastreio-search"
                           placeholder="Pesquisar por nome do equipamento ou nº patrimônio..."
                           oninput="App.modules.rastreio.filter(this.value)">
                </div>
                <table class="data-table">
                    <thead><tr>
                        <th>Equipamento</th>
                        <th>Nº Patrimônio</th>
                        <th>Nº Série</th>
                        <th>Localização Atual</th>
                        <th>Responsável</th>
                        <th>Com quem está</th>
                        <th>Última Movimentação</th>
                    </tr></thead>
                    <tbody id="rastreio-tbody">
                        ${Views.app._rastreioRows(data)}
                    </tbody>
                </table>
            </div>
        `,

        _rastreioRows: (data) => {
            if (data.length === 0) return `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum equipamento rastreado. Registre movimentações para começar.</td></tr>`;
            return data.map(d => `
                <tr data-search="${escapeHtml(((d.equipment?.name||'') + ' ' + (d.asset_number||'')).toLowerCase())}">
                    <td><strong>${d.equipment ? escapeHtml(d.equipment.name) : '—'}</strong></td>
                    <td>${escapeHtml(d.asset_number) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td style="color:var(--text-secondary);">${escapeHtml(d.serial_number) || '—'}</td>
                    <td><span class="location-tag"><i data-lucide="map-pin" style="width:13px;flex-shrink:0;"></i>${d.room ? escapeHtml(d.room.name) : '—'}</span></td>
                    <td>${d.profile ? escapeHtml(d.profile.full_name) : '—'}</td>
                    <td>${escapeHtml(d.received_by) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                    <td style="color:var(--text-secondary);white-space:nowrap;">
                        ${new Date(d.moved_at).toLocaleDateString('pt-BR')}
                        <span style="font-size:12px;opacity:.7;"> ${new Date(d.moved_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                    </td>
                </tr>
            `).join('');
        },

        /* ── MAPA DE SALAS ───────────────────────────────────────────── */
        mapaSalas: (rooms) => `
            <div class="view-header">
                <div>
                    <h2>Mapa de Salas</h2>
                    <p>Visualize quais equipamentos estão em cada sala.</p>
                </div>
            </div>
            <div class="room-map-grid fade-in">
                ${rooms.length === 0 ? `<p style="color:var(--text-secondary);grid-column:1/-1;text-align:center;padding:40px;">Nenhuma sala cadastrada.</p>` : ''}
                ${rooms.map(room => `
                    <div class="room-map-card room-map-card--clickable" onclick="App.modules.mapaSalas.showRoomDetail('${escapeHtml(room.id)}')"
                         title="Clique para ver todos os equipamentos">
                        <div class="room-map-header">
                            <div class="room-map-header-top">
                                <div>
                                    <h3>${escapeHtml(room.name)}</h3>
                                    ${room.room_number ? `<div class="room-sub">Sala ${escapeHtml(room.room_number)}</div>` : ''}
                                </div>
                                <span class="room-map-count ${room.items.length === 0 ? 'empty' : ''}">
                                    ${room.items.length} item${room.items.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                        <div class="room-map-body">
                            ${room.items.length === 0
                                ? `<div class="room-map-empty"><i data-lucide="package-open" style="width:24px;height:24px;opacity:.4;display:block;margin:0 auto 8px;"></i>Sem equipamentos</div>`
                                : room.items.map(item => `
                                    <div class="room-map-item">
                                        <i data-lucide="package" style="width:15px;color:var(--accent-color);flex-shrink:0;"></i>
                                        <div class="room-map-item-info">
                                            <div class="room-map-item-name">${item.equipment ? escapeHtml(item.equipment.name) : '—'}</div>
                                            <div class="room-map-item-sub">
                                                ${item.asset_number ? `PAT: ${escapeHtml(item.asset_number)}` : ''}
                                                ${item.asset_number && item.received_by ? ' · ' : ''}
                                                ${item.received_by ? `<i data-lucide="user" style="width:10px;vertical-align:middle;"></i> ${escapeHtml(item.received_by)}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')
                            }
                        </div>
                        ${room.coordinator || room.description ? `
                            <div class="room-map-footer">
                                ${room.coordinator ? `<i data-lucide="user-check" style="width:13px;flex-shrink:0;"></i> ${escapeHtml(room.coordinator)}` : ''}
                                ${room.coordinator && room.description ? ' · ' : ''}
                                ${room.description ? escapeHtml(room.description) : ''}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `,

        /* ── SALAS ───────────────────────────────────────────────────── */
        salas: (salas) => `
            <div class="view-header">
                <div>
                    <h2>Gestão de Salas</h2>
                    <p>Cadastre os ambientes onde os chamados podem ocorrer.</p>
                </div>
                <button class="btn-primary" onclick="App.modules.salas.showCreateModal()"><i data-lucide="plus"></i> Cadastrar Sala</button>
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
                    <tbody>
                        ${salas.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhuma sala cadastrada no sistema.</td></tr>' : ''}
                        ${salas.map(sala => `
                            <tr>
                                <td style="color:var(--text-secondary);font-weight:600;">${escapeHtml(sala.room_number) || '—'}</td>
                                <td><strong>${escapeHtml(sala.name)}</strong></td>
                                <td>${escapeHtml(sala.coordinator) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                                <td>${escapeHtml(sala.description) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                                <td><span class="badge-status ${sala.status ? escapeHtml(sala.status.toLowerCase().replace(/\s+/g,'_')) : 'ativa'}">${escapeHtml(sala.status) || 'Ativa'}</span></td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn-table-action edit" onclick="App.modules.salas.editRoom('${escapeHtml(sala.id)}')"><i data-lucide="pencil"></i> Editar</button>
                                        <button class="btn-table-action delete" onclick="App.modules.salas.deleteRoom(this,'${escapeHtml(sala.id)}')"><i data-lucide="trash-2"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
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
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
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
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div class="form-group">
                                <label>Número da Sala <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                <input type="text" id="edit-room-number" class="form-control" value="${escapeHtml(sala.room_number || '')}">
                            </div>
                            <div class="form-group">
                                <label>Coordenador <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                                <input type="text" id="edit-room-coordinator" class="form-control" value="${escapeHtml(sala.coordinator || '')}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Descrição / Setor <span style="color:var(--text-secondary);font-weight:400">(Opcional)</span></label>
                            <input type="text" id="edit-room-description" class="form-control" value="${escapeHtml(sala.description || '')}">
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
        usuarios: (usuarios) => `
            <div class="view-header">
                <div>
                    <h2>Controle de Usuários</h2>
                    <p>Gerencie os colaboradores e níveis de acesso.</p>
                </div>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead><tr>
                        <th>Nome do Colaborador</th>
                        <th>Nível de Acesso</th>
                        <th>Data de Ingresso</th>
                    </tr></thead>
                    <tbody>
                        ${usuarios.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum usuário cadastrado.</td></tr>' : ''}
                        ${usuarios.map(u => `
                            <tr>
                                <td><strong>${escapeHtml(u.full_name) || 'Usuário Sem Nome'}</strong></td>
                                <td>
                                    <select class="role-select" onchange="App.modules.usuarios.updateRole('${escapeHtml(u.id)}',this.value)">
                                        <option value="usuario" ${u.role==='usuario'||!u.role?'selected':''}>Usuário</option>
                                        <option value="tecnico" ${u.role==='tecnico'?'selected':''}>Técnico</option>
                                        <option value="admin"   ${u.role==='admin'?'selected':''}>Admin</option>
                                    </select>
                                </td>
                                <td style="color:var(--text-secondary);">${new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,

        /* ── WORKFLOW (KANBAN) ───────────────────────────────────────── */
        workflow: (tickets) => {
            const cols = {
                aberto:       tickets.filter(t => t.status === 'aberto'),
                em_progresso: tickets.filter(t => t.status === 'em_progresso'),
                resolvido:    tickets.filter(t => t.status === 'resolvido')
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
                            <i data-lucide="map-pin" style="width:12px"></i> ${ticket.rooms ? escapeHtml(ticket.rooms.name) : 'Sem local'}
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
                        <div class="kanban-cards">${cols.aberto.map(renderCard).join('')||'<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px 0;">Nenhum chamado</p>'}</div>
                    </div>
                    <div class="kanban-column" data-status="em_progresso" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event)">
                        <div class="kanban-header" style="color:var(--warning-color);"><span style="display:flex;align-items:center;gap:8px;"><i data-lucide="loader-2" style="width:18px"></i> Em Progresso</span><span class="count">${cols.em_progresso.length}</span></div>
                        <div class="kanban-cards">${cols.em_progresso.map(renderCard).join('')||'<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px 0;">Nenhum chamado</p>'}</div>
                    </div>
                    <div class="kanban-column" data-status="resolvido" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event)">
                        <div class="kanban-header" style="color:var(--success-color);"><span style="display:flex;align-items:center;gap:8px;"><i data-lucide="check-circle" style="width:18px"></i> Resolvidos</span><span class="count">${cols.resolvido.length}</span></div>
                        <div class="kanban-cards">${cols.resolvido.map(renderCard).join('')||'<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:16px 0;">Nenhum chamado</p>'}</div>
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
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div class="form-group">
                                <label>Local afetado</label>
                                <select id="ticket-room" class="form-control" required>
                                    <option value="" disabled selected>Selecione a sala...</option>
                                    ${rooms.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('')}
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
            const statusLabels = { aberto:'Aberto', em_progresso:'Em Progresso', resolvido:'Resolvido' };
            const otherStatuses = ['aberto','em_progresso','resolvido'].filter(s => s !== ticket.status);
            const moveIcons  = { aberto:'alert-circle', em_progresso:'loader-2', resolvido:'check-circle' };
            const moveLabels = { aberto:'Aberto', em_progresso:'Em Progresso', resolvido:'Resolvido' };
            return `
                <div class="modal-overlay" id="ticket-detail-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span class="badge-status ${escapeHtml(ticket.priority)}">${escapeHtml(ticket.priority)}</span>
                                <span class="badge-status ${escapeHtml(ticket.status)}">${escapeHtml(statusLabels[ticket.status]||ticket.status)}</span>
                            </div>
                            <button class="modal-close" type="button" onclick="document.getElementById('ticket-detail-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                        <h3 style="font-size:18px;color:var(--primary-color);margin-bottom:12px;font-weight:700;">${escapeHtml(ticket.title)}</h3>
                        <p style="color:var(--text-secondary);font-size:14px;line-height:1.6;margin-bottom:24px;white-space:pre-wrap;">${escapeHtml(ticket.description)}</p>
                        <div class="detail-meta-grid">
                            <div class="detail-meta-item"><span class="detail-meta-label">Local</span><span>${ticket.rooms?escapeHtml(ticket.rooms.name):'—'}</span></div>
                            <div class="detail-meta-item"><span class="detail-meta-label">Solicitante</span><span>${ticket.profiles?(escapeHtml(ticket.profiles.full_name)||'—'):'—'}</span></div>
                            <div class="detail-meta-item"><span class="detail-meta-label">Aberto em</span><span>${new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span></div>
                        </div>
                        <div style="border-top:1px solid var(--border-color);padding-top:20px;">
                            ${otherStatuses.length > 0 ? `
                                <div style="font-size:12px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;margin-bottom:10px;letter-spacing:.5px;">Mover para</div>
                                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
                                    ${otherStatuses.map(s => `<button class="btn-move-status" onclick="App.modules.workflow.moveTicket('${escapeHtml(ticket.id)}','${s}')"><i data-lucide="${moveIcons[s]}"></i> ${moveLabels[s]}</button>`).join('')}
                                </div>
                            ` : ''}
                            <button id="btn-delete-ticket" class="btn-danger" onclick="App.modules.workflow.deleteTicket('${escapeHtml(ticket.id)}')">
                                <i data-lucide="trash-2"></i> Excluir Chamado
                            </button>
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
                            ${room.room_number ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">Sala ${escapeHtml(room.room_number)}</div>` : ''}
                        </div>
                        <button class="modal-close" type="button" onclick="document.getElementById('sala-detail-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    ${(room.coordinator || room.description) ? `
                    <div style="display:flex;gap:16px;flex-wrap:wrap;padding:12px 0 16px;border-bottom:1px solid var(--border-color);margin-bottom:16px;">
                        ${room.coordinator ? `<span style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);"><i data-lucide="user-check" style="width:14px;"></i> ${escapeHtml(room.coordinator)}</span>` : ''}
                        ${room.description ? `<span style="font-size:13px;color:var(--text-secondary);">${escapeHtml(room.description)}</span>` : ''}
                    </div>` : ''}
                    <table class="data-table">
                        <thead><tr>
                            <th>Equipamento</th>
                            <th>Nº Patrimônio</th>
                            <th>Nº Série</th>
                            <th>Recebedor</th>
                            <th>Última Movimentação</th>
                        </tr></thead>
                        <tbody>
                            ${room.items.length === 0
                                ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-secondary);">Nenhum equipamento nesta sala no momento.</td></tr>`
                                : room.items.map(item => `
                                    <tr>
                                        <td><strong>${escapeHtml(item.name)}</strong></td>
                                        <td>${escapeHtml(item.asset_number) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                                        <td style="color:var(--text-secondary);">${escapeHtml(item.serial_number) || '—'}</td>
                                        <td>${escapeHtml(item.received_by) || '<span style="color:var(--text-secondary)">—</span>'}</td>
                                        <td style="color:var(--text-secondary);white-space:nowrap;">
                                            ${item.moved_at
                                                ? `${new Date(item.moved_at).toLocaleDateString('pt-BR')} <span style="font-size:12px;opacity:.7">${new Date(item.moved_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>`
                                                : '—'}
                                        </td>
                                    </tr>`).join('')
                            }
                        </tbody>
                    </table>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;">
                        <span style="font-size:13px;color:var(--text-secondary);">${room.items.length} equipamento${room.items.length !== 1 ? 's' : ''} encontrado${room.items.length !== 1 ? 's' : ''}</span>
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
                            <input type="text" class="form-control" readonly value="${movement.equipment ? escapeHtml(movement.equipment.name) : '—'}">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div class="form-group">
                                <label>Nº de Série</label>
                                <input type="text" id="edit-mov-serial" class="form-control" value="${escapeHtml(movement.serial_number || '')}" placeholder="Ex: SN123456789">
                            </div>
                            <div class="form-group">
                                <label>Nº Patrimônio</label>
                                <input type="text" id="edit-mov-asset" class="form-control" value="${escapeHtml(movement.asset_number || '')}" placeholder="Ex: PAT-00123">
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div class="form-group">
                                <label>Origem <span style="color:var(--danger-color)">*</span></label>
                                <input type="text" id="edit-mov-origin" class="form-control" list="edit-rooms-origin" required
                                       value="${movement.origin ? escapeHtml(movement.origin.name) : ''}" autocomplete="off">
                                <datalist id="edit-rooms-origin">
                                    ${rooms.map(r => `<option value="${escapeHtml(r.name)}"></option>`).join('')}
                                </datalist>
                            </div>
                            <div class="form-group">
                                <label>Destino <span style="color:var(--danger-color)">*</span></label>
                                <input type="text" id="edit-mov-destination" class="form-control" list="edit-rooms-dest" required
                                       value="${movement.destination ? escapeHtml(movement.destination.name) : ''}" autocomplete="off">
                                <datalist id="edit-rooms-dest">
                                    ${rooms.map(r => `<option value="${escapeHtml(r.name)}"></option>`).join('')}
                                </datalist>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div class="form-group">
                                <label>Recebedor</label>
                                <input type="text" id="edit-mov-received-by" class="form-control" value="${escapeHtml(movement.received_by || '')}" placeholder="Nome de quem recebe...">
                            </div>
                            <div class="form-group">
                                <label>Data / Hora <span style="color:var(--danger-color)">*</span></label>
                                <input type="datetime-local" id="edit-mov-date" class="form-control" required
                                       value="${(() => { if (!movement.moved_at) return ''; const d = new Date(movement.moved_at); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; })()}">
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
                        ${logs.length === 0
                            ? `<p style="text-align:center;color:var(--text-secondary);padding:28px 0;">Nenhum registro de edição encontrado.</p>`
                            : logs.map(log => `
                                <div class="edit-log-entry">
                                    <div class="edit-log-header">
                                        <span class="edit-log-who"><i data-lucide="user" style="width:12px;"></i> ${escapeHtml(log.editor_name)}</span>
                                        <span class="edit-log-when">${new Date(log.edited_at).toLocaleDateString('pt-BR')} às ${new Date(log.edited_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                                    </div>
                                    <div class="edit-info-reason">${escapeHtml(log.edit_reason)}</div>
                                </div>
                            `).join('')}
                    </div>
                    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
                        <button class="btn-primary" style="background:#e2e8f0;color:#475569;" onclick="document.getElementById('edit-info-modal').remove()">Fechar</button>
                    </div>
                </div>
            </div>
        `
    }
};
