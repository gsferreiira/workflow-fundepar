// views.js
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
        dashboard: (stats) => `
            <div class="view-header">
                <div>
                    <h2>Olá, ${Auth.user.full_name || 'Usuário'}</h2>
                    <p>Resumo da operação e controle de atividades hoje.</p>
                </div>
            </div>
            <div class="stat-grid fade-in">
                <div class="stat-card">
                    <div class="icon-box"><i data-lucide="ticket"></i></div>
                    <div><div class="value">${stats.totalOpen || 0}</div><div class="label">Chamados Pendentes</div></div>
                </div>
                <div class="stat-card">
                    <div class="icon-box" style="background: rgba(16, 185, 129, 0.1); color: var(--success-color);"><i data-lucide="check-circle"></i></div>
                    <div><div class="value">${stats.totalResolved || 0}</div><div class="label">Chamados Resolvidos</div></div>
                </div>
                <div class="stat-card">
                    <div class="icon-box" style="background: rgba(245, 158, 11, 0.1); color: var(--warning-color);"><i data-lucide="map-pin"></i></div>
                    <div><div class="value">${stats.totalRooms || 0}</div><div class="label">Locais / Salas Cadastradas</div></div>
                </div>
            </div>
        `,

        salas: (salas) => `
            <div class="view-header">
                <div>
                    <h2>Gestão de Salas e Locais</h2>
                    <p>Organização dos ambientes e responsáveis da Fundepar.</p>
                </div>
                <button class="btn-primary" onclick="App.modules.salas.showCreateModal()"><i data-lucide="plus"></i> Cadastrar Nova Sala</button>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome do Local</th>
                            <th>Tipo / Categoria</th>
                            <th>Setor / Departamento</th>
                            <th>Chefe do Setor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${salas.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding: 32px; color: var(--text-secondary);">Nenhuma sala cadastrada.</td></tr>' : ''}
                        ${salas.map(sala => `
                            <tr>
                                <td><strong>${sala.name}</strong></td>
                                <td><span class="badge-status aberto">${sala.room_type || 'Não definido'}</span></td>
                                <td>${sala.description || '-'}</td>
                                <td><div style="display:flex; align-items:center; gap:8px;"><i data-lucide="user" style="width:14px"></i> ${sala.department_head || 'Não informado'}</div></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,

        usuarios: (usuarios) => `
            <div class="view-header">
                <div>
                    <h2>Controle de Usuários</h2>
                    <p>Gerencie o nível de acesso da equipe. (Apenas Admins podem alterar cargos).</p>
                </div>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome do Colaborador</th>
                            <th>Nível de Acesso (Cargo)</th>
                            <th>Data de Ingresso</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${usuarios.map(u => `
                            <tr>
                                <td><strong>${u.full_name || 'Usuário Sem Nome'}</strong></td>
                                <td>
                                    <span class="badge-status ${u.role === 'admin' ? 'urgente' : u.role === 'tecnico' ? 'media' : 'baixa'}">
                                        ${u.role || 'usuario'}
                                    </span>
                                </td>
                                <td style="color: var(--text-secondary);">${new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                                <td>
                                    ${Auth.user.role === 'admin' 
                                        ? `<button class="btn-icon" title="Editar Permissões" onclick="App.modules.usuarios.showRoleModal('${u.id}', '${u.full_name}', '${u.role}')"><i data-lucide="shield"></i></button>` 
                                        : '<span style="color:var(--text-secondary); font-size:12px;">Sem permissão</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,

        workflow: (tickets) => {
            const cols = {
                aberto: tickets.filter(t => t.status === 'aberto'),
                em_progresso: tickets.filter(t => t.status === 'em_progresso'),
                resolvido: tickets.filter(t => t.status === 'resolvido')
            };

            const renderCard = (ticket) => `
                <div class="kanban-card" draggable="true" ondragstart="App.modules.workflow.dragStart(event, '${ticket.id}')">
                    <h4>${ticket.title}</h4>
                    <p>${ticket.description}</p>
                    <div class="kanban-card-meta">
                        <span class="badge-status ${ticket.priority}">${ticket.priority}</span>
                        <span style="color: var(--text-secondary); display:flex; align-items:center; gap: 4px;">
                            <i data-lucide="map-pin" style="width: 12px"></i> ${ticket.rooms ? ticket.rooms.name : 'Sem local'}
                        </span>
                    </div>
                </div>
            `;

            return `
                <div class="view-header">
                    <div>
                        <h2>Painel Kanban (Workflow)</h2>
                        <p>Arraste e solte os cartões para atualizar o status.</p>
                    </div>
                    <button class="btn-primary" onclick="App.modules.workflow.showCreateModal()"><i data-lucide="plus"></i> Abrir Chamado</button>
                </div>
                
                <div class="kanban-board fade-in">
                    <div class="kanban-column" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event, 'aberto')">
                        <div class="kanban-header">
                            <span style="display:flex; align-items:center; gap:8px;"><i data-lucide="alert-circle" style="width:18px"></i> Abertos</span>
                            <span class="count">${cols.aberto.length}</span>
                        </div>
                        <div class="kanban-cards">${cols.aberto.map(renderCard).join('')}</div>
                    </div>

                    <div class="kanban-column" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event, 'em_progresso')">
                        <div class="kanban-header" style="color: var(--warning-color);">
                            <span style="display:flex; align-items:center; gap:8px;"><i data-lucide="loader-2" style="width:18px"></i> Em Progresso</span>
                            <span class="count">${cols.em_progresso.length}</span>
                        </div>
                        <div class="kanban-cards">${cols.em_progresso.map(renderCard).join('')}</div>
                    </div>

                    <div class="kanban-column" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event, 'resolvido')">
                        <div class="kanban-header" style="color: var(--success-color);">
                            <span style="display:flex; align-items:center; gap:8px;"><i data-lucide="check-circle" style="width:18px"></i> Resolvidos</span>
                            <span class="count">${cols.resolvido.length}</span>
                        </div>
                        <div class="kanban-cards">${cols.resolvido.map(renderCard).join('')}</div>
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
                    <form onsubmit="App.modules.workflow.createTicket(event)">
                        <div class="form-group">
                            <label>Título / Resumo do Problema</label>
                            <input type="text" id="ticket-title" class="form-control" required placeholder="Ex: Projetor não liga">
                        </div>
                        <div class="form-group">
                            <label>Descrição Completa</label>
                            <textarea id="ticket-desc" class="form-control" required rows="4" placeholder="Detalhe o que está acontecendo..."></textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Local afetado</label>
                                <select id="ticket-room" class="form-control" required>
                                    <option value="" disabled selected>Selecione a sala...</option>
                                    ${rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
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
                        <div style="display:flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                            <button type="button" class="btn-primary" style="background: #e2e8f0; color: #475569;" onclick="document.getElementById('ticket-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Enviar Solicitação</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        salaModal: () => `
            <div class="modal-overlay" id="sala-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Configurar Novo Ambiente</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('sala-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form onsubmit="App.modules.salas.create(event)">
                        <div class="form-group">
                            <label>Nome da Sala (Ex: Sala 204)</label>
                            <input type="text" id="sala-name" class="form-control" required placeholder="Ex: Laboratório de Robótica">
                        </div>
                        <div class="form-group">
                            <label>Nome do Chefe/Responsável pelo Setor</label>
                            <input type="text" id="sala-head" class="form-control" required placeholder="Ex: Prof. Carlos Alberto">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Tipo de Sala</label>
                                <select id="sala-type" class="form-control" required>
                                    <option value="Sala de Aula">Sala de Aula</option>
                                    <option value="Laboratório">Laboratório</option>
                                    <option value="Administrativo">Administrativo</option>
                                    <option value="Auditório">Auditório</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Bloco / Departamento (Opcional)</label>
                                <input type="text" id="sala-desc" class="form-control" placeholder="Ex: Bloco B - 2º Andar">
                            </div>
                        </div>
                        <div style="display:flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                            <button type="button" class="btn-primary" style="background: #e2e8f0; color: #475569;" onclick="document.getElementById('sala-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Finalizar Cadastro</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        roleModal: (user) => `
            <div class="modal-overlay" id="role-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Gestão de Permissões</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('role-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form onsubmit="App.modules.usuarios.updateRole(event, '${user.id}')">
                        <div class="form-group">
                            <label>Colaborador</label>
                            <input type="text" class="form-control" value="${user.name}" disabled style="background: #f8fafc; color: #64748b;">
                        </div>
                        <div class="form-group">
                            <label>Nível de Acesso (Cargo)</label>
                            <select id="user-role" class="form-control">
                                <option value="usuario" ${user.role === 'usuario' ? 'selected' : ''}>Usuário Padrão (Abre chamados)</option>
                                <option value="tecnico" ${user.role === 'tecnico' ? 'selected' : ''}>Técnico (Gerencia Workflow)</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador (Acesso total)</option>
                            </select>
                        </div>
                        <div style="display:flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                            <button type="button" class="btn-primary" style="background: #e2e8f0; color: #475569;" onclick="document.getElementById('role-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Atualizar Permissão</button>
                        </div>
                    </form>
                </div>
            </div>
        `
    }
};