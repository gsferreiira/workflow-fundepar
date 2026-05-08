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
                ${Auth.user.role === 'admin' ? `<button class="btn-primary" onclick="App.modules.salas.showCreateModal()"><i data-lucide="plus"></i> Cadastrar Nova Sala</button>` : ''}
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
                    <p>Gerencie equipe, setores e permissões de acesso.</p>
                </div>
                <button class="btn-primary" onclick="App.modules.usuarios.showCreateModal()"><i data-lucide="user-plus"></i> Cadastrar Usuário</button>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome do Colaborador</th>
                            <th>Setor</th>
                            <th>Cargo / Função</th>
                            <th>Nível de Acesso</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${usuarios.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 32px; color: var(--text-secondary);">Nenhum usuário cadastrado.</td></tr>' : ''}
                        ${usuarios.map(u => `
                            <tr>
                                <td><strong>${u.full_name || 'Sem Nome'}</strong></td>
                                <td>${u.department || '-'}</td>
                                <td>${u.job_title || '-'}</td>
                                <td><span class="badge-status ${u.role === 'admin' ? 'urgente' : u.role === 'tecnico' ? 'media' : 'baixa'}">${u.role || 'usuario'}</span></td>
                                <td>
                                    <button class="btn-icon" title="Editar Usuário" onclick="App.modules.usuarios.showEditModal('${u.id}')"><i data-lucide="edit"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,

        workflow: (tickets) => {
            const activeTickets = tickets.filter(t => t.status !== 'fechado');
            
            const cols = {
                aberto: activeTickets.filter(t => t.status === 'aberto'),
                em_progresso: activeTickets.filter(t => t.status === 'em_progresso'),
                resolvido: activeTickets.filter(t => t.status === 'resolvido')
            };

            const renderCard = (ticket) => `
                <div class="kanban-card" draggable="true" 
                     ondragstart="App.modules.workflow.dragStart(event, '${ticket.id}')"
                     onclick="App.modules.workflow.showDetailModal('${ticket.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <h4>${ticket.title}</h4>
                        <span style="font-size: 10px; color: var(--text-secondary);">#${ticket.id.split('-')[0].toUpperCase()}</span>
                    </div>
                    <p>${ticket.description}</p>
                    <div class="kanban-card-meta">
                        <span style="color: var(--text-secondary); display:flex; align-items:center; gap: 4px;">
                            <i data-lucide="map-pin" style="width: 12px"></i> ${ticket.rooms ? ticket.rooms.name : 'Sem local'}
                        </span>
                    </div>
                    <div class="kanban-card-meta" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                        <span style="font-size: 11px; color: ${ticket.assignee_id ? 'var(--success-color)' : 'var(--warning-color)'}; display:flex; align-items:center; gap: 6px; font-weight: 500;">
                            <i data-lucide="${ticket.assignee_id ? 'user-check' : 'inbox'}" style="width: 14px"></i> 
                            ${ticket.assignee_name || 'BASE (Aguardando Captura)'}
                        </span>
                    </div>
                </div>
            `;

            return `
                <div class="view-header">
                    <div>
                        <h2>Painel Kanban (Workflow)</h2>
                        <p>Gerencie a fila de atendimento da BASE e seus chamados capturados.</p>
                    </div>
                    <button class="btn-primary" onclick="App.modules.workflow.showCreateModal()"><i data-lucide="plus"></i> Abrir Chamado</button>
                </div>
                
                <div class="kanban-board fade-in">
                    <div class="kanban-column" ondragover="event.preventDefault()" ondrop="App.modules.workflow.drop(event, 'aberto')">
                        <div class="kanban-header">
                            <span style="display:flex; align-items:center; gap:8px;"><i data-lucide="alert-circle" style="width:18px"></i> Abertos (Base)</span>
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

        // --- MODAIS ---

        // NOVO: Modal do próprio Perfil (Para trocar senha e dados)
        myProfileModal: (user) => `
            <div class="modal-overlay" id="my-profile-modal" onclick="if(event.target === this) this.remove()">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h3>Meu Perfil</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('my-profile-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form onsubmit="App.updateMyProfile(event)">
                        <div class="form-group">
                            <label>Nome Completo</label>
                            <input type="text" id="my-profile-name" class="form-control" required value="${user.full_name || ''}">
                        </div>
                        <div class="form-group">
                            <label>E-mail</label>
                            <input type="text" class="form-control" disabled value="${user.email || ''}" style="background: #f1f5f9; color: #64748b;">
                        </div>
                        <div class="form-group" style="margin-top: 24px;">
                            <label style="color: var(--primary-color); font-weight: 600;"><i data-lucide="key" style="width:14px"></i> Redefinir Senha</label>
                            <input type="password" id="my-profile-pass" class="form-control" placeholder="Digite uma nova senha (opcional)">
                            <small style="color: var(--text-secondary); font-size: 11px;">Deixe em branco para manter a senha atual.</small>
                        </div>
                        <div style="display:flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                            <button type="button" class="btn-primary" style="background: #e2e8f0; color: #475569;" onclick="document.getElementById('my-profile-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Perfil</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        ticketDetailModal: (ticket, comments, technicians) => {
            const isAssigned = !!ticket.assignee_id;
            const assigneeName = isAssigned ? (technicians.find(t => t.id === ticket.assignee_id)?.full_name || 'Desconhecido') : null;
            const isMyTicket = ticket.assignee_id === Auth.user.id;
            const isAdmin = Auth.user.role === 'admin';

            return `
            <div class="modal-overlay" id="detail-modal" onclick="if(event.target === this) this.remove()">
                <div class="modal-content" style="max-width: 850px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; padding: 24px;">
                    
                    <div class="detail-main" style="display: flex; flex-direction: column; max-height: 70vh;">
                        <div class="modal-header" style="margin-bottom: 16px;">
                            <h3>OS #${ticket.id.split('-')[0].toUpperCase()}</h3>
                            <button class="modal-close" onclick="document.getElementById('detail-modal').remove()"><i data-lucide="x"></i></button>
                        </div>
                        
                        <div style="margin-bottom: 24px;">
                            <h2 style="font-size: 20px; color: var(--primary-color); margin-bottom: 8px;">${ticket.title}</h2>
                            <p style="color: var(--text-secondary); line-height: 1.5; font-size: 14px;">${ticket.description}</p>
                        </div>

                        <div class="comments-section" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                            <h4 style="margin-bottom: 12px; font-size: 13px; text-transform: uppercase; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">Histórico e Recados</h4>
                            
                            <div id="comments-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; padding-right: 8px;">
                                ${comments.length === 0 ? '<p style="font-size: 13px; color: var(--text-secondary);">Nenhum registro encontrado.</p>' : ''}
                                ${comments.map(c => {
                                    const isSystem = c.content.startsWith('📌') || c.content.startsWith('🔄') || c.content.startsWith('🚨');
                                    let bgColor = isSystem ? '#f0fdf4' : '#f1f5f9';
                                    let borderColor = isSystem ? '#bbf7d0' : 'transparent';
                                    let textColor = isSystem ? '#166534' : 'inherit';
                                    
                                    if(c.content.startsWith('🚨')) {
                                        bgColor = '#fff1f2'; borderColor = '#fecdd3'; textColor = '#9f1239';
                                    }

                                    return `
                                    <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 12px; border-radius: 8px;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                                            <strong style="font-size: 12px; color: ${textColor};">${c.profiles?.full_name || 'Sistema'}</strong>
                                            <small style="font-size: 10px; color: var(--text-secondary);">${new Date(c.created_at).toLocaleString('pt-BR')}</small>
                                        </div>
                                        <p style="font-size: 13px; color: ${textColor};">${c.content}</p>
                                    </div>
                                    `
                                }).join('')}
                            </div>
                            
                            <form onsubmit="App.modules.workflow.addComment(event, '${ticket.id}')" style="display:flex; gap: 8px; margin-top: auto;">
                                <input type="text" id="new-comment" class="form-control" placeholder="Adicionar um recado manual..." required>
                                <button type="submit" class="btn-primary" style="padding: 8px 16px;"><i data-lucide="send"></i></button>
                            </form>
                        </div>
                    </div>

                    <div class="detail-side" style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); display: flex; flex-direction: column; overflow-y: auto;">
                        <h4 style="margin-bottom: 16px; font-size: 14px; font-weight: 700;">Status do Atendimento</h4>
                        
                        <div class="info-item" style="margin-bottom: 16px;">
                            <label style="font-size: 11px; color: var(--text-secondary); display:block;">Solicitante original</label>
                            <span style="font-size: 14px; font-weight: 500;">${ticket.profiles?.full_name || 'Desconhecido'}</span>
                        </div>

                        <div class="info-item" style="margin-bottom: 16px;">
                            <label style="font-size: 11px; color: var(--text-secondary); display:block;">Local Afetado</label>
                            <span style="font-size: 14px; font-weight: 500;"><i data-lucide="map-pin" style="width:12px"></i> ${ticket.rooms?.name || 'Não informado'}</span>
                        </div>

                        <div class="info-item" style="margin-bottom: 24px; padding: 12px; border-radius: 8px; background: ${isAssigned ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid ${isAssigned ? '#a7f3d0' : '#fde68a'};">
                            <label style="font-size: 11px; color: ${isAssigned ? 'var(--success-color)' : 'var(--warning-color)'}; display:block; font-weight: 600;">Técnico Responsável</label>
                            <span style="font-size: 14px; font-weight: 700; color: var(--text-primary); display:flex; align-items:center; gap:6px; margin-top:4px;">
                                <i data-lucide="${isAssigned ? 'user-check' : 'inbox'}" style="width:16px"></i>
                                ${isAssigned ? assigneeName : 'NA BASE (Aguardando)'}
                            </span>
                        </div>

                        ${ticket.assignee_id !== Auth.user.id ? `
                            <button class="btn-primary" style="width: 100%; margin-bottom: 16px; background: var(--accent-color); padding: 14px;" onclick="App.modules.workflow.captureTicket('${ticket.id}', '${ticket.assignee_name || ''}')">
                                <i data-lucide="hand"></i> ${ticket.assignee_id ? 'ASSUMIR ESTA OS' : 'CAPTURAR ESTA OS'}
                            </button>
                        ` : ''}

                        ${isAssigned && (isMyTicket || isAdmin) ? `
                            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 16px;">
                                <label style="font-size: 12px; font-weight: 700; color: var(--primary-color); display:flex; align-items:center; gap:6px; margin-bottom: 12px;">
                                    <i data-lucide="forward" style="width:14px"></i> Repassar OS
                                </label>
                                <select id="reassign-tech" class="form-control" style="margin-bottom: 12px; font-size: 13px; padding: 10px;">
                                    <option value="">Selecione o técnico...</option>
                                    ${technicians.filter(t => t.id !== ticket.assignee_id).map(t => `<option value="${t.id}">${t.full_name}</option>`).join('')}
                                </select>
                                <input type="text" id="reassign-reason" class="form-control" placeholder="Motivo do repasse..." style="margin-bottom: 12px; font-size: 13px; padding: 10px;">
                                <button class="btn-primary" type="button" style="width: 100%; font-size: 13px; padding: 10px; background: var(--warning-color);" onclick="App.modules.workflow.reassignTicket('${ticket.id}')">
                                    Confirmar Repasse
                                </button>
                            </div>
                        ` : ''}

                        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                            ${ticket.status === 'resolvido' ? `
                                <button class="btn-primary" style="width: 100%; background: var(--success-color);" onclick="App.modules.workflow.archiveTicket('${ticket.id}')">
                                    <i data-lucide="archive"></i> Arquivar e Concluir
                                </button>
                            ` : `
                                <div style="text-align:center; padding: 12px; border: 1px dashed var(--border-color); border-radius: 8px;">
                                    <span style="font-size: 11px; color: var(--text-secondary);">Mova a OS para 'Resolvido' no painel Kanban para liberar o arquivamento.</span>
                                </div>
                            `}
                            <button class="btn-primary" style="width: 100%; background: #e2e8f0; color: var(--text-primary);" onclick="document.getElementById('detail-modal').remove()">
                                Fechar Janela
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        },

        userCreateModal: () => `
            <div class="modal-overlay" id="user-create-modal" onclick="if(event.target === this) this.remove()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Cadastrar Novo Colaborador</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('user-create-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form onsubmit="App.modules.usuarios.createUser(event)">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Nome Completo</label>
                                <input type="text" id="new-user-name" class="form-control" required placeholder="Ex: João Silva">
                            </div>
                            <div class="form-group">
                                <label>E-mail Corporativo</label>
                                <input type="email" id="new-user-email" class="form-control" required placeholder="joao@fundepar.gov.br">
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Setor / Departamento</label>
                                <input type="text" id="new-user-dept" class="form-control" required placeholder="Ex: Financeiro">
                            </div>
                            <div class="form-group">
                                <label>Cargo / Função</label>
                                <input type="text" id="new-user-job" class="form-control" required placeholder="Ex: Analista">
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Nível de Acesso</label>
                                <select id="new-user-role" class="form-control" required>
                                    <option value="usuario">Usuário Padrão</option>
                                    <option value="tecnico">Técnico</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Senha Inicial</label>
                                <input type="password" id="new-user-pass" class="form-control" required placeholder="Mínimo 6 caracteres">
                            </div>
                        </div>
                        <div style="display:flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                            <button type="button" class="btn-primary" style="background: #e2e8f0; color: #475569;" onclick="document.getElementById('user-create-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Criar Conta</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        userEditModal: (user) => `
            <div class="modal-overlay" id="user-edit-modal" onclick="if(event.target === this) this.remove()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Editar Perfil de Usuário</h3>
                        <button class="modal-close" type="button" onclick="document.getElementById('user-edit-modal').remove()"><i data-lucide="x"></i></button>
                    </div>
                    <form onsubmit="App.modules.usuarios.updateUser(event, '${user.id}')">
                        <div class="form-group">
                            <label>Nome do Colaborador</label>
                            <input type="text" class="form-control" value="${user.full_name}" disabled style="background: #f8fafc; color: #64748b;">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Setor / Departamento</label>
                                <input type="text" id="edit-user-dept" class="form-control" value="${user.department || ''}" placeholder="Ex: TI">
                            </div>
                            <div class="form-group">
                                <label>Cargo / Função</label>
                                <input type="text" id="edit-user-job" class="form-control" value="${user.job_title || ''}" placeholder="Ex: Suporte N1">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Nível de Acesso (Permissão)</label>
                            <select id="edit-user-role" class="form-control">
                                <option value="usuario" ${user.role === 'usuario' ? 'selected' : ''}>Usuário Padrão (Apenas OS)</option>
                                <option value="tecnico" ${user.role === 'tecnico' ? 'selected' : ''}>Técnico (Workflow e Salas)</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador (Acesso Total)</option>
                            </select>
                        </div>
                        <div class="form-group" style="background: #fffbeb; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 4px; margin-top: 16px;">
                            <label style="color: #b45309; font-size: 12px; display:flex; align-items:center; gap:4px;"><i data-lucide="info" style="width:14px"></i> Troca de Senha</label>
                            <span style="font-size: 12px; color: #92400e; display:block; margin-top: 4px;">Por segurança, para redefinir a senha deste usuário, utilize o painel oficial <strong>Authentication</strong> no Supabase ou peça para ele mesmo alterar no perfil dele.</span>
                        </div>
                        <div style="display:flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                            <button type="button" class="btn-primary" style="background: #e2e8f0; color: #475569;" onclick="document.getElementById('user-edit-modal').remove()">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        ticketModal: (rooms) => `...`, // Já estava ok
        searchResultsModal: (results, term) => `...`, // Já estava ok
        salaModal: () => `...` // Já estava ok
    }
};

// Mantendo os modais padrões que não mudaram para evitar erros caso copie tudo:
Views.app.ticketModal = (rooms) => `
    <div class="modal-overlay" id="ticket-modal" onclick="if(event.target === this) this.remove()">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Nova Solicitação</h3>
                <button class="modal-close" type="button" onclick="document.getElementById('ticket-modal').remove()"><i data-lucide="x"></i></button>
            </div>
            <form onsubmit="App.modules.workflow.createTicket(event)">
                <div class="form-group">
                    <label>Título da OS / Resumo</label>
                    <input type="text" id="ticket-title" class="form-control" required placeholder="Ex: Ajuste de rede">
                </div>
                <div class="form-group">
                    <label>Descrição Completa</label>
                    <textarea id="ticket-desc" class="form-control" required rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Local Afetado</label>
                    <select id="ticket-room" class="form-control" required>
                        <option value="" disabled selected>Selecione...</option>
                        ${rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                </div>
                <div style="display:flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                    <button type="button" class="btn-primary" style="background: #e2e8f0; color: #475569;" onclick="document.getElementById('ticket-modal').remove()">Cancelar</button>
                    <button type="submit" class="btn-primary">Abrir Chamado</button>
                </div>
            </form>
        </div>
    </div>
`;

Views.app.searchResultsModal = (results, term) => `
    <div class="modal-overlay" id="search-modal" onclick="if(event.target === this) this.remove()">
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Resultados para "${term}"</h3>
                <button class="modal-close" type="button" onclick="document.getElementById('search-modal').remove()"><i data-lucide="x"></i></button>
            </div>
            <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
                ${results.length === 0 ? '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Nenhum chamado encontrado.</p>' : ''}
                ${results.map(t => `
                    <div style="border: 1px solid var(--border-color); padding: 16px; border-radius: 8px; cursor: pointer; transition: 0.2s;" 
                         onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)'"
                         onclick="document.getElementById('search-modal').remove(); App.modules.workflow.showDetailModal('${t.id}')">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <h4 style="color: var(--primary-color); font-size: 15px;">${t.title}</h4>
                            <span class="badge-status ${t.status}">${t.status}</span>
                        </div>
                        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">ID: #${t.id.split('-')[0].toUpperCase()}</p>
                        <div style="font-size: 12px; color: var(--text-secondary); display: flex; gap: 12px;">
                            <span style="display:flex; align-items:center; gap: 4px;"><i data-lucide="map-pin" style="width:12px"></i> ${t.rooms?.name || 'Sem local'}</span>
                            <span style="display:flex; align-items:center; gap: 4px;"><i data-lucide="user" style="width:12px"></i> Solicitante: ${t.profiles?.full_name || 'Desconhecido'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
`;

Views.app.salaModal = () => `
    <div class="modal-overlay" id="sala-modal" onclick="if(event.target === this) this.remove()">
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
`;