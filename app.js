// app.js

// Objeto para gerenciar alertas visuais e de carregamento na interface
const UI = {
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i> ${message}`;
        
        container.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        // Remove o aviso após 4 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    showLoading: () => {
        document.getElementById('view-content').innerHTML = `
            <div style="display:flex; justify-content:center; padding: 100px; color: var(--text-secondary);">
                <i data-lucide="loader-2" style="animation: spin 1s linear infinite; width: 40px; height: 40px;"></i>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// Lógica Principal da Single Page Application (SPA)
const App = {
    
    init: async () => {
        // Inicializa Autenticação e verifica sessão
        await Auth.init();
        
        // Configura Roteamento (escutar mudanças na URL)
        window.addEventListener('hashchange', App.handleRoute);
    },

    // 1. Controla a exibição da tela de Login
    showAuthView: () => {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
        App.loadLogin(); // Carrega view de login por padrão
    },

    // 2. Controla a exibição do App Principal logado
    showAppView: () => {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        // Renderiza perfil na sidebar
        App.renderSidebarProfile();
        App.handleRoute(); // Processa a rota atual (dashboard, salas, etc)
        if (typeof lucide !== 'undefined') lucide.createIcons(); // Re-renderizar ícones
    },

    // 3. Sistema de Roteamento Profissional (Vanilla)
    handleRoute: () => {
        const route = window.location.hash || '#dashboard';
        const viewContent = document.getElementById('view-content');
        
        // Atualiza navegação sidebar
        App.updateActiveNavLink(route);
        UI.showLoading(); // Mostra esqueleto de loading

        switch (route) {
            case '#dashboard': App.modules.dashboard.init(); break;
            case '#workflow': viewContent.innerHTML = '<h2>Workflow (Em Desenvolvimento)</h2>'; break; // Kanban
            case '#salas': App.modules.salas.init(); break; // CADASTRO DE SALAS
            case '#usuarios': App.modules.usuarios.init(); break; // CADASTRO DE USUÁRIOS
            default: viewContent.innerHTML = '<h2>404 - Tela não encontrada</h2>';
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons(); // Inicializar ícones na nova view
    },

    // =========================================
    // 4. MÓDULOS DE NEGÓCIO DA SPA
    // =========================================
    modules: {
        dashboard: {
            init: async () => {
                const viewContent = document.getElementById('view-content');
                // Busca estatísticas no Supabase
                const { count: totalOpen } = await supabaseClient.from('tickets').select('*', { count: 'exact' }).eq('status', 'aberto');
                const { count: totalRooms } = await supabaseClient.from('rooms').select('*', { count: 'exact' });
                
                viewContent.innerHTML = Views.app.dashboard({ totalOpen, totalRooms });
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        },
        
        // MODULO COMPLETO: GESTÃO DE SALAS (CRUD)
        salas: {
            init: async () => {
                // 1. Busca Salas no Supabase
                const { data: salas, error } = await supabaseClient
                    .from('rooms')
                    .select('*')
                    .order('name');
                
                if (error) { UI.showToast(error.message, 'danger'); return; }
                
                // 2. Renderiza View de Salas
                document.getElementById('view-content').innerHTML = Views.app.salas(salas);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },
            
            showCreateForm: () => {
                const name = prompt("Nome da Sala:");
                if (!name) return;
                const description = prompt("Descrição (Opcional):");
                
                App.modules.salas.create(name, description);
            },
            
            create: async (name, description) => {
                // Inserir sala no Supabase
                const { data, error } = await supabaseClient
                    .from('rooms')
                    .insert([{ name, description }]);
                
                if (error) {
                    UI.showToast('Erro ao criar sala: ' + error.message, 'danger');
                } else {
                    UI.showToast('Sala cadastrada com sucesso!', 'success');
                    App.modules.salas.init(); // Recarrega tabela
                }
            }
        },

        // MODULO: GESTÃO DE USUÁRIOS
        usuarios: {
            init: async () => {
                // Busca Perfis no Supabase
                const { data: usuarios, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .order('full_name');
                
                if (error) { UI.showToast(error.message, 'danger'); return; }
                
                document.getElementById('view-content').innerHTML = Views.app.usuarios(usuarios);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    },

    // =========================================
    // 5. FUNÇÕES AUXILIARES DA INTERFACE
    // =========================================
    
    loadLogin: () => {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = Views.auth.login(); // Injeta o HTML do formulário
        
        // Listener para o envio do formulário de login
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            
            btn.textContent = 'Autenticando...';
            btn.disabled = true;
            
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            
            await Auth.signIn(email, pass);
            
            btn.textContent = originalText;
            btn.disabled = false;
        });

        // Trocar para a tela de registro
        document.getElementById('go-to-register').addEventListener('click', (e) => {
            e.preventDefault();
            App.loadRegister();
        });
    },

    loadRegister: () => {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = Views.auth.register(); // Injeta o HTML do formulário de registro
        
        // Listener para o envio do formulário de cadastro
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            
            btn.textContent = 'Criando conta...';
            btn.disabled = true;
            
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const pass = document.getElementById('register-password').value;
            
            await Auth.signUp(name, email, pass);
            
            btn.textContent = originalText;
            btn.disabled = false;
        });

        // Voltar para a tela de login
        document.getElementById('go-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            App.loadLogin();
        });
    },

    renderSidebarProfile: () => {
        const container = document.getElementById('sidebar-profile');
        if(container && Auth.user) {
            // Cria um avatar dinâmico com as iniciais do usuário
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURI(Auth.user.full_name)}&background=0c4a6e&color=fff`;
            
            container.innerHTML = `
                <img src="${avatarUrl}" alt="Avatar" class="avatar">
                <div class="profile-info">
                    <div class="name">${Auth.user.full_name}</div>
                    <div class="role" style="text-transform: capitalize;">${Auth.user.role}</div>
                </div>
                <button class="btn-logout" onclick="Auth.signOut()" title="Sair da Conta">
                    <i data-lucide="log-out"></i>
                </button>
            `;
        }
    },

    updateActiveNavLink: (route) => {
        // Remove a classe 'active' de todos os itens de menu
        document.querySelectorAll('.sidebar-menu ul li').forEach(li => li.classList.remove('active'));
        
        // Adiciona a classe 'active' no link correspondente à URL atual
        const link = document.querySelector(`.sidebar-menu a[href="${route}"]`);
        if(link) {
            link.parentElement.classList.add('active');
        }
    }
};

// Iniciar Aplicação
App.init();