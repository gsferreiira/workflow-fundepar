// app.js

const UI = {
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'danger') icon = 'alert-circle';
        if (type === 'warning') icon = 'loader';

        toast.innerHTML = `<i data-lucide="${icon}"></i> ${message}`;
        container.appendChild(toast);
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    showLoading: () => {
        document.getElementById('view-content').innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height: 50vh; color: var(--accent-color);">
                <i data-lucide="loader-2" style="animation: spin 1s linear infinite; width: 48px; height: 48px;"></i>
            </div>
        `;
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
        if (loader) {
            loader.style.opacity = '0'; 
            setTimeout(() => loader.remove(), 400); 
        }
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
        App.handleRoute(); 
    },

    handleRoute: () => {
        const route = window.location.hash || '#dashboard';
        const viewContent = document.getElementById('view-content');
        
        App.updateActiveNavLink(route);
        UI.showLoading(); 
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }

        switch (route) {
            case '#dashboard': App.modules.dashboard.init(); break;
            case '#workflow': App.modules.workflow.init(); break;
            case '#salas': App.modules.salas.init(); break;
            case '#usuarios': App.modules.usuarios.init(); break;
            default: viewContent.innerHTML = '<div style="text-align:center; padding: 40px;"><h2>Erro 404</h2><p style="color:var(--text-secondary)">A tela procurada não existe.</p></div>';
        }
    },

    toggleMobileMenu: () => {
        document.getElementById('sidebar').classList.toggle('open');
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
                const { data: tickets, error } = await supabaseClient
                    .from('tickets')
                    .select('*, rooms(name), profiles:requester_id(full_name)')
                    .order('created_at', { ascending: false });

                if (error) { UI.showToast(error.message, 'danger'); return; }

                document.getElementById('view-content').innerHTML = Views.app.workflow(tickets);
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
                    priority: document.getElementById('ticket-priority').value,
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
                    UI.showToast('Chamado aberto com sucesso!', 'success');
                    App.modules.workflow.init(); 
                }
            },

            dragStart: (event, ticketId) => {
                event.dataTransfer.setData('ticketId', ticketId);
            },

            drop: async (event, newStatus) => {
                event.preventDefault();
                const ticketId = event.dataTransfer.getData('ticketId');
                
                if(!ticketId) return;

                const { error } = await supabaseClient
                    .from('tickets')
                    .update({ status: newStatus })
                    .eq('id', ticketId);

                if (error) {
                    UI.showToast('Falha ao atualizar status.', 'danger');
                } else {
                    App.modules.workflow.init(); 
                }
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

            showRoleModal: (id, name, role) => {
                document.getElementById('modal-root').innerHTML = Views.app.roleModal({ id, name, role });
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            updateRole: async (e, userId) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Atualizando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const newRole = document.getElementById('user-role').value;

                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ role: newRole })
                    .eq('id', userId);

                if (error) {
                    UI.showToast('Erro ao atualizar permissão: ' + error.message, 'danger');
                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    document.getElementById('role-modal').remove();
                    UI.showToast('Permissão atualizada com sucesso!', 'success');
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

    renderSidebarProfile: () => {
        const container = document.getElementById('sidebar-profile');
        if(container && Auth.user) {
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURI(Auth.user.full_name || 'U')}&background=0c4a6e&color=fff`;
            container.innerHTML = `
                <img src="${avatarUrl}" alt="Avatar" class="avatar">
                <div class="profile-info">
                    <div class="name" title="${Auth.user.full_name}">${Auth.user.full_name || 'Usuário'}</div>
                    <div class="role">${Auth.user.role || 'Usuário'}</div>
                </div>
                <button class="btn-logout" onclick="Auth.signOut()" title="Sair do Sistema">
                    <i data-lucide="log-out"></i>
                </button>
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