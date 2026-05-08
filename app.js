// app.js

const UI = {
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = type === 'success' ? 'check-circle' : 'alert-circle';
        toast.innerHTML = `<i data-lucide="${icon}"></i> ${message}`;
        container.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
    },
    showLoading: () => {
        document.getElementById('view-content').innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height: 50vh; color: var(--accent-color);"><i data-lucide="loader-2" style="animation: spin 1s linear infinite; width: 48px; height: 48px;"></i></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

const App = {
    init: async () => {
        await Auth.init();
        window.addEventListener('hashchange', App.handleRoute);
    },

    removeLoader: () => {
        const loader = document.getElementById('initial-loader');
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 400); }
    },

    showAuthView: () => {
        App.removeLoader();
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
        App.loadLogin(); 
    },

    showAppView: () => {
        App.removeLoader();
        const appContainer = document.getElementById('app-container');
        if (!appContainer.classList.contains('hidden')) return; 
        document.getElementById('auth-container').classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        App.renderSidebarProfile();
        App.applyMenuPermissions(); 
        App.handleRoute(); 
    },

    // Permissões do Menu
    applyMenuPermissions: () => {
        const role = Auth.user.role;
        const menuSalas = document.getElementById('menu-salas');
        const menuUsuarios = document.getElementById('menu-usuarios');
        const menuAdminSep = document.getElementById('menu-admin-sep');

        if (role === 'usuario') {
            if(menuSalas) menuSalas.style.display = 'none';
            if(menuUsuarios) menuUsuarios.style.display = 'none';
            if(menuAdminSep) menuAdminSep.style.display = 'none';
        } else if (role === 'tecnico') {
            if(menuSalas) menuSalas.style.display = 'block';
            if(menuUsuarios) menuUsuarios.style.display = 'none';
            if(menuAdminSep) menuAdminSep.style.display = 'block';
        } else {
            if(menuSalas) menuSalas.style.display = 'block';
            if(menuUsuarios) menuUsuarios.style.display = 'block';
            if(menuAdminSep) menuAdminSep.style.display = 'block';
        }
    },

    handleRoute: () => {
        const route = window.location.hash || '#dashboard';
        const role = Auth.user.role;

        if (route === '#usuarios' && role !== 'admin') {
            window.location.hash = '#dashboard';
            UI.showToast('Acesso negado. Apenas administradores.', 'danger');
            return;
        }
        if (route === '#salas' && role === 'usuario') {
            window.location.hash = '#dashboard';
            UI.showToast('Acesso negado.', 'danger');
            return;
        }

        App.updateActiveNavLink(route);
        UI.showLoading(); 
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');

        switch (route) {
            case '#dashboard': App.modules.dashboard.init(); break;
            case '#workflow': App.modules.workflow.init(); break;
            case '#salas': App.modules.salas.init(); break;
            case '#usuarios': App.modules.usuarios.init(); break;
        }
    },

    toggleMobileMenu: () => { document.getElementById('sidebar').classList.toggle('open'); },

    // ==========================================
    // FUNÇÕES DE PERFIL (Visualizar/Alterar Senha)
    // ==========================================
    showProfileModal: () => {
        // Usa as informações da variável global Auth.user que tem os dados locais
        document.getElementById('modal-root').innerHTML = Views.app.myProfileModal({
            full_name: Auth.user.full_name,
            email: Auth.user.email
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    updateMyProfile: async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Salvando...';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const newName = document.getElementById('my-profile-name').value;
        const newPass = document.getElementById('my-profile-pass').value;

        // Atualiza nome no banco de dados de Perfis
        const { error: profileError } = await supabaseClient.from('profiles').update({ full_name: newName }).eq('id', Auth.user.id);
        
        if (profileError) {
            UI.showToast('Erro ao salvar nome', 'danger');
            btn.disabled = false; return;
        }

        // Se o usuário digitou uma senha nova, envia pro Supabase Auth
        if (newPass.trim() !== '') {
            const { error: passError } = await supabaseClient.auth.updateUser({ password: newPass });
            if (passError) {
                UI.showToast('Erro ao atualizar senha: ' + passError.message, 'danger');
                btn.disabled = false; return;
            }
        }

        Auth.user.full_name = newName; 
        App.renderSidebarProfile(); // Atualiza nome ali embaixo na esquerda
        document.getElementById('my-profile-modal').remove();
        UI.showToast('Perfil atualizado com sucesso!', 'success');
    },

    globalSearch: async (term) => {
        if (!term || !term.trim()) return;
        
        const searchInput = document.getElementById('global-search');
        const iconElement = searchInput.previousElementSibling;
        iconElement.outerHTML = `<i data-lucide="loader-2" style="animation: spin 1s linear infinite; color: var(--accent-color);"></i>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            const { data: textResults } = await supabaseClient
                .from('tickets')
                .select('*, rooms(name), profiles:requester_id(full_name)')
                .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
                .order('created_at', { ascending: false })
                .limit(50);

            const { data: recentTickets } = await supabaseClient
                .from('tickets')
                .select('*, rooms(name), profiles:requester_id(full_name)')
                .order('created_at', { ascending: false })
                .limit(1000);
            
            let allResults = [...(textResults || [])];
            
            if (recentTickets) {
                const idMatches = recentTickets.filter(t => t.id.toLowerCase().includes(term.toLowerCase()));
                idMatches.forEach(match => {
                    if (!allResults.find(t => t.id === match.id)) allResults.push(match);
                });
            }

            document.getElementById('modal-root').innerHTML = Views.app.searchResultsModal(allResults, term);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (error) {
            UI.showToast('Erro ao realizar a pesquisa', 'danger');
        } finally {
            document.querySelector('.search-bar').firstElementChild.outerHTML = `<i data-lucide="search"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            searchInput.value = ''; 
        }
    },

    modules: {
        dashboard: {
            init: async () => {
                const { count: totalOpen } = await supabaseClient.from('tickets').select('*', { count: 'exact' }).eq('status', 'aberto');
                const { count: totalResolved } = await supabaseClient.from('tickets').select('*', { count: 'exact' }).eq('status', 'resolvido');
                const { count: totalRooms } = await supabaseClient.from('rooms').select('*', { count: 'exact' });
                document.getElementById('view-content').innerHTML = Views.app.dashboard({ totalOpen, totalResolved, totalRooms });
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        },

        workflow: {
            init: async () => {
                const { data: tickets } = await supabaseClient.from('tickets').select('*, rooms(name), profiles:requester_id(full_name)').order('created_at', { ascending: false });
                
                const { data: techs } = await supabaseClient.from('profiles').select('id, full_name');
                if (tickets && techs) {
                    tickets.forEach(t => {
                        if (t.assignee_id) {
                            const tech = techs.find(u => u.id === t.assignee_id);
                            t.assignee_name = tech ? tech.full_name : 'Técnico';
                        }
                    });
                }

                document.getElementById('view-content').innerHTML = Views.app.workflow(tickets || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            showCreateModal: async () => {
                const { data: rooms } = await supabaseClient.from('rooms').select('id, name');
                document.getElementById('modal-root').innerHTML = Views.app.ticketModal(rooms || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            createTicket: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Processando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const newTicket = {
                    title: document.getElementById('ticket-title').value,
                    description: document.getElementById('ticket-desc').value,
                    room_id: document.getElementById('ticket-room').value,
                    requester_id: Auth.user.id,
                    status: 'aberto'
                };

                const { error } = await supabaseClient.from('tickets').insert([newTicket]);

                if (error) {
                    UI.showToast('Erro ao criar chamado: ' + error.message, 'danger');
                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    document.getElementById('ticket-modal').remove();
                    UI.showToast('Chamado aberto e enviado para a BASE!', 'success');
                    App.modules.workflow.init(); 
                }
            },

            showDetailModal: async (ticketId) => {
                const { data: ticket } = await supabaseClient.from('tickets').select('*, rooms(name), profiles:requester_id(full_name)').eq('id', ticketId).single();
                const { data: comments } = await supabaseClient.from('ticket_comments').select('*, profiles:user_id(full_name)').eq('ticket_id', ticketId).order('created_at', { ascending: true });
                const { data: technicians } = await supabaseClient.from('profiles').select('id, full_name').in('role', ['admin', 'tecnico']);

                // Puxa o nome do tecnico atual para injetar no botão de "Assumir"
                let currentTechName = '';
                if(ticket.assignee_id && technicians) {
                    const tech = technicians.find(t => t.id === ticket.assignee_id);
                    if(tech) { currentTechName = tech.full_name; ticket.assignee_name = tech.full_name; }
                }

                document.getElementById('modal-root').innerHTML = Views.app.ticketDetailModal(ticket, comments || [], technicians || []);
                
                const commentsList = document.getElementById('comments-list');
                if (commentsList) commentsList.scrollTop = commentsList.scrollHeight;

                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            // --- NOVO LÓGICA DE ASSUMIR/CAPTURAR OS ---
            captureTicket: async (ticketId, oldTechName) => {
                await supabaseClient.from('tickets').update({ 
                    assignee_id: Auth.user.id,
                    status: 'em_progresso' 
                }).eq('id', ticketId);

                // Define mensagem diferente se for roubada de alguém ou se estava na base
                let logContent = `📌 OS Capturada na BASE e iniciada por ${Auth.user.full_name}.`;
                if (oldTechName && oldTechName.trim() !== '') {
                    logContent = `🚨 OS Assumida por ${Auth.user.full_name} (Anteriormente com ${oldTechName}).`;
                }

                await supabaseClient.from('ticket_comments').insert([{
                    ticket_id: ticketId,
                    user_id: Auth.user.id,
                    content: logContent
                }]);

                UI.showToast('OS Assumida com sucesso!', 'success');
                App.modules.workflow.showDetailModal(ticketId);
                App.modules.workflow.init();
            },

            reassignTicket: async (ticketId) => {
                const techDropdown = document.getElementById('reassign-tech');
                const techId = techDropdown.value;
                const reason = document.getElementById('reassign-reason').value;

                if (!techId || !reason.trim()) {
                    UI.showToast('Você deve selecionar um técnico e informar o motivo!', 'warning');
                    return;
                }

                const techName = techDropdown.options[techDropdown.selectedIndex].text;

                await supabaseClient.from('tickets').update({ assignee_id: techId }).eq('id', ticketId);

                await supabaseClient.from('ticket_comments').insert([{
                    ticket_id: ticketId,
                    user_id: Auth.user.id,
                    content: `🔄 OS Repassada para ${techName}. Motivo: ${reason}`
                }]);

                UI.showToast('OS repassada com sucesso!', 'success');
                App.modules.workflow.showDetailModal(ticketId);
                App.modules.workflow.init();
            },

            addComment: async (e, ticketId) => {
                e.preventDefault();
                const content = document.getElementById('new-comment').value;
                const { error } = await supabaseClient.from('ticket_comments').insert([{
                    ticket_id: ticketId, user_id: Auth.user.id, content: content
                }]);
                if (error) {
                    UI.showToast(error.message, 'danger');
                } else {
                    App.modules.workflow.showDetailModal(ticketId); 
                }
            },

            archiveTicket: async (ticketId) => {
                const { error } = await supabaseClient.from('tickets').update({ status: 'fechado' }).eq('id', ticketId);
                if (error) {
                    UI.showToast(error.message, 'danger');
                } else { 
                    document.getElementById('detail-modal').remove(); 
                    UI.showToast('OS Arquivada com sucesso!', 'success'); 
                    App.modules.workflow.init(); 
                }
            },

            dragStart: (event, id) => event.dataTransfer.setData('ticketId', id),
            
            drop: async (event, newStatus) => {
                const id = event.dataTransfer.getData('ticketId');
                await supabaseClient.from('tickets').update({ status: newStatus }).eq('id', id);
                App.modules.workflow.init();
            }
        },

        salas: {
            init: async () => {
                const { data: salas, error } = await supabaseClient.from('rooms').select('*').order('name');
                if (error) { UI.showToast(error.message, 'danger'); return; }
                
                document.getElementById('view-content').innerHTML = Views.app.salas(salas);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },
            
            showCreateModal: () => {
                document.getElementById('modal-root').innerHTML = Views.app.salaModal();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },
            
            create: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const newSala = {
                    name: document.getElementById('sala-name').value,
                    department_head: document.getElementById('sala-head').value,
                    room_type: document.getElementById('sala-type').value,
                    description: document.getElementById('sala-desc').value
                };

                const { error } = await supabaseClient.from('rooms').insert([newSala]);

                if (error) {
                    UI.showToast('Erro ao criar sala: ' + error.message, 'danger');
                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    document.getElementById('sala-modal').remove();
                    UI.showToast('Sala e Responsável cadastrados!', 'success');
                    App.modules.salas.init(); 
                }
            }
        },

        usuarios: {
            init: async () => {
                const { data: usuarios, error } = await supabaseClient.from('profiles').select('*').order('full_name');
                if (error) { UI.showToast(error.message, 'danger'); return; }
                
                document.getElementById('view-content').innerHTML = Views.app.usuarios(usuarios);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            showCreateModal: () => {
                document.getElementById('modal-root').innerHTML = Views.app.userCreateModal();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            createUser: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Processando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const name = document.getElementById('new-user-name').value;
                const email = document.getElementById('new-user-email').value;
                const pass = document.getElementById('new-user-pass').value;
                const dept = document.getElementById('new-user-dept').value;
                const job = document.getElementById('new-user-job').value;
                const role = document.getElementById('new-user-role').value;

                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: pass,
                    options: { 
                        data: { 
                            full_name: name,
                            department: dept,
                            job_title: job,
                            role: role
                        } 
                    }
                });

                if (error) {
                    UI.showToast('Erro ao criar: ' + error.message, 'danger');
                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    document.getElementById('user-create-modal').remove();
                    UI.showToast('Usuário cadastrado com sucesso!', 'success');
                    
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if(session && session.user.email === email) {
                        setTimeout(() => {
                            UI.showToast('Sessão alterada. Faça login com sua conta Admin novamente.', 'warning');
                            window.location.reload();
                        }, 2000);
                    } else {
                        App.modules.usuarios.init(); 
                    }
                }
            },

            showEditModal: async (userId) => {
                const { data: user } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
                if(user) {
                    document.getElementById('modal-root').innerHTML = Views.app.userEditModal(user);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            },

            updateUser: async (e, userId) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Atualizando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const newRole = document.getElementById('edit-user-role').value;
                const newDept = document.getElementById('edit-user-dept').value;
                const newJob = document.getElementById('edit-user-job').value;

                const { error } = await supabaseClient.from('profiles').update({ 
                    role: newRole,
                    department: newDept,
                    job_title: newJob
                }).eq('id', userId);

                if (error) {
                    UI.showToast('Erro ao atualizar: ' + error.message, 'danger');
                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    document.getElementById('user-edit-modal').remove();
                    UI.showToast('Perfil atualizado com sucesso!', 'success');
                    App.modules.usuarios.init(); 
                }
            }
        }
    },

    loadLogin: () => {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = Views.auth.login(); 
        
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            
            btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            btn.disabled = true;
            
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            
            await Auth.signIn(email, pass);
            
            if (document.getElementById('login-form')) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });

        document.getElementById('go-to-register').addEventListener('click', (e) => {
            e.preventDefault();
            App.loadRegister();
        });
    },

    loadRegister: () => {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = Views.auth.register(); 
        
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            
            btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            btn.disabled = true;
            
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const pass = document.getElementById('register-password').value;
            
            await Auth.signUp(name, email, pass);
            
            if (document.getElementById('register-form')) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });

        document.getElementById('go-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            App.loadLogin();
        });
    },

    // AQUI OCORREU A MÁGICA: BOTAO DE SAIR E PERFIL CLICÁVEL
    renderSidebarProfile: () => {
        const container = document.getElementById('sidebar-profile');
        if(container && Auth.user) {
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURI(Auth.user.full_name || 'U')}&background=0c4a6e&color=fff`;
            
            container.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; width: 100%;">
                    <div style="display:flex; align-items:center; gap: 12px; cursor: pointer; flex: 1; overflow: hidden;" onclick="App.showProfileModal()" title="Ver meu perfil">
                        <img src="${avatarUrl}" alt="Avatar" class="avatar" style="flex-shrink:0;">
                        <div class="profile-info" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                            <div class="name" style="font-size: 13px;">${Auth.user.full_name || 'Usuário'}</div>
                            <div class="role" style="font-size: 11px; text-transform: capitalize; color: var(--accent-color);">${Auth.user.role || 'Usuário'}</div>
                        </div>
                    </div>
                    <button class="btn-logout" onclick="Auth.signOut()" title="Sair do Sistema" style="display:flex; align-items:center; gap: 4px; padding: 6px 10px; background: rgba(239, 68, 68, 0.1); color: var(--danger-color); border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2); margin-left: 8px;">
                        <i data-lucide="log-out" style="width: 14px;"></i> <span style="font-size: 12px; font-weight: 600;">Sair</span>
                    </button>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    },

    updateActiveNavLink: (route) => {
        document.querySelectorAll('.sidebar-menu ul li').forEach(li => li.classList.remove('active'));
        const link = document.querySelector(`.sidebar-menu a[href="${route}"]`);
        if(link) {
            link.parentElement.classList.add('active');
        }
    }
};

App.init();