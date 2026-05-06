// views.js
// Este arquivo armazena as interfaces (telas) da aplicação.

const Views = {
    // 1. Definição das Telas de Autenticação
    auth: {
        login: () => `
            <div class="auth-card">
                <div class="logo-container">
                    <div style="background: var(--primary-color); color: white; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; border-radius: 12px; margin: 0 auto 16px auto;">F</div>
                </div>
                <h2>Bem-vindo de volta</h2>
                <p class="subtitle">Faça login para gerenciar o sistema.</p>
                <form id="login-form">
                    <div class="form-group">
                        <label for="login-email">E-mail Corporativo</label>
                        <input type="email" id="login-email" class="form-control" required placeholder="Ex: nome@fundepar.gov.br">
                    </div>
                    <div class="form-group">
                        <label for="login-password">Senha</label>
                        <input type="password" id="login-password" class="form-control" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn-primary">Entrar</button>
                </form>
                <div class="auth-footer">
                    Não tem uma conta? <a href="#" id="go-to-register">Registre-se</a>
                </div>
            </div>
        `,
        register: () => `
            <div class="auth-card">
                <div class="logo-container">
                    <div style="background: var(--primary-color); color: white; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; border-radius: 12px; margin: 0 auto 16px auto;">F</div>
                </div>
                <h2>Criar nova conta</h2>
                <p class="subtitle">Cadastre-se na plataforma.</p>
                <form id="register-form">
                    <div class="form-group">
                        <label for="register-name">Nome Completo</label>
                        <input type="text" id="register-name" class="form-control" required placeholder="Ex: Maria Souza">
                    </div>
                    <div class="form-group">
                        <label for="register-email">E-mail Corporativo</label>
                        <input type="email" id="register-email" class="form-control" required placeholder="Ex: nome@fundepar.gov.br">
                    </div>
                    <div class="form-group">
                        <label for="register-password">Crie sua Senha</label>
                        <input type="password" id="register-password" class="form-control" required placeholder="Mínimo 6 caracteres">
                    </div>
                    <button type="submit" class="btn-primary">Criar Conta</button>
                </form>
                <div class="auth-footer">
                    Já tem uma conta? <a href="#" id="go-to-login">Faça Login</a>
                </div>
            </div>
        `
    },

    // 2. Definição das Telas Internas do Sistema
    app: {
        dashboard: (stats) => `
            <div class="view-header">
                <div>
                    <h2>Olá, ${Auth.user.full_name || 'Usuário'}</h2>
                    <p>Aqui está o resumo da sua operação hoje.</p>
                </div>
            </div>
            <div class="stat-grid fade-in">
                <div class="stat-card">
                    <div class="icon-box"><i data-lucide="ticket"></i></div>
                    <div><div class="value">${stats.totalOpen || 0}</div><div class="label">Chamados em Aberto</div></div>
                </div>
                <div class="stat-card">
                    <div class="icon-box"><i data-lucide="building"></i></div>
                    <div><div class="value">${stats.totalRooms || 0}</div><div class="label">Salas Cadastradas</div></div>
                </div>
            </div>
        `,

        salas: (salas) => `
            <div class="view-header">
                <div>
                    <h2>Gerenciamento de Salas</h2>
                    <p>Controle os locais para manutenção e abertura de chamados.</p>
                </div>
                <button class="btn-primary" onclick="App.modules.salas.showCreateForm()"><i data-lucide="plus"></i> Nova Sala</button>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome da Sala</th>
                            <th>Descrição</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${salas.length === 0 ? '<tr><td colspan="3" style="text-align:center; padding: 20px;">Nenhuma sala cadastrada.</td></tr>' : ''}
                        ${salas.map(sala => `
                            <tr>
                                <td><strong>${sala.name}</strong></td>
                                <td>${sala.description || '-'}</td>
                                <td><span class="badge-status ${sala.status || 'ativa'}">${sala.status || 'Ativa'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,
        
        usuarios: (usuarios) => `
            <div class="view-header">
                <div>
                    <h2>Gerenciamento de Usuários</h2>
                    <p>Controle os acessos cadastrados na plataforma.</p>
                </div>
            </div>
            <div class="table-card fade-in">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome Completo</th>
                            <th>Nível de Acesso</th>
                            <th>Status Conta</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${usuarios.map(u => `
                            <tr>
                                <td><strong>${u.full_name || 'Sem nome'}</strong></td>
                                <td style="text-transform: capitalize;">${u.role || 'usuario'}</td>
                                <td><span class="badge-status ativa">Ativo</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
    }
};