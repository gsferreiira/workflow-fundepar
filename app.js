// app.js

const UI = {
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'danger')  icon = 'alert-circle';
        if (type === 'warning') icon = 'alert-triangle';
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
            <div style="display:flex;justify-content:center;align-items:center;height:50vh;color:var(--accent-color);">
                <i data-lucide="loader-2" style="animation:spin 1s linear infinite;width:48px;height:48px;"></i>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

const App = {
    init: async () => {
        await Auth.init();
        window.addEventListener('hashchange', App.handleRoute);
    },

    showAuthView: () => {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
        App.loadLogin();
    },

    showAppView: () => {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        App.darkMode.init();
        App.renderSidebarProfile();
        App.handleRoute();
        App.notifications.init();
    },

    handleRoute: () => {
        const route = window.location.hash || '#dashboard';
        const viewContent = document.getElementById('view-content');
        App.updateActiveNavLink(route);
        UI.showLoading();
        App.closeMobileMenu();
        switch (route) {
            case '#dashboard':    App.modules.dashboard.init();    break;
            case '#workflow':     App.modules.workflow.init();     break;
            case '#salas':        App.modules.salas.init();        break;
            case '#usuarios':     App.modules.usuarios.init();     break;
            case '#equipamentos':  App.modules.equipamentos.init();  break;
            case '#movimentacoes': App.modules.movimentacoes.init(); break;
            case '#rastreio':      App.modules.rastreio.init();      break;
            case '#mapa-salas':    App.modules.mapaSalas.init();    break;
            case '#perfil':        App.modules.perfil.init();       break;
            default: viewContent.innerHTML = '<div style="text-align:center;padding:40px;"><h2>Erro 404</h2><p style="color:var(--text-secondary)">A tela procurada não existe.</p></div>';
        }
    },

    toggleMobileMenu: () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-backdrop').classList.toggle('active');
    },

    closeMobileMenu: () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-backdrop').classList.remove('active');
    },

    modules: {

        /* ── DASHBOARD ──────────────────────────────────────────────── */
        dashboard: {
            init: async () => {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
                sixMonthsAgo.setDate(1);
                sixMonthsAgo.setHours(0, 0, 0, 0);

                const [
                    { count: totalOpen },
                    { count: totalResolved },
                    { count: totalRooms },
                    { count: totalEquipment },
                    { data: recentMovements },
                    { data: rooms },
                    { data: profilesList },
                    { data: chartMovements }
                ] = await Promise.all([
                    supabaseClient.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
                    supabaseClient.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolvido'),
                    supabaseClient.from('rooms').select('*', { count: 'exact', head: true }),
                    supabaseClient.from('equipment').select('*', { count: 'exact', head: true }),
                    supabaseClient.from('asset_movements')
                        .select('*, equipment(name)')
                        .order('moved_at', { ascending: false })
                        .limit(8),
                    supabaseClient.from('rooms').select('id, name'),
                    supabaseClient.from('profiles').select('id, full_name'),
                    supabaseClient.from('asset_movements')
                        .select('moved_at')
                        .gte('moved_at', sixMonthsAgo.toISOString())
                ]);

                const roomMap    = Object.fromEntries((rooms        || []).map(r => [r.id, r]));
                const profileMap = Object.fromEntries((profilesList || []).map(p => [p.id, p]));
                const recent = (recentMovements || []).map(m => ({
                    ...m,
                    origin:      roomMap[m.origin_room_id]      || null,
                    destination: roomMap[m.destination_room_id] || null,
                    profiles:    profileMap[m.moved_by]         || null
                }));

                // Build monthly chart data (last 6 months)
                const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                const chartData = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
                    chartData.push({ label: monthNames[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), count: 0 });
                }
                (chartMovements || []).forEach(m => {
                    const d = new Date(m.moved_at);
                    const entry = chartData.find(c => c.month === d.getMonth() && c.year === d.getFullYear());
                    if (entry) entry.count++;
                });

                document.getElementById('view-content').innerHTML = Views.app.dashboard({ totalOpen, totalResolved, totalRooms, totalEquipment }, recent, chartData);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        },

        /* ── WORKFLOW (KANBAN) ──────────────────────────────────────── */
        workflow: {
            _tickets: [],
            _isDragging: false,

            init: async () => {
                const { data: tickets, error } = await supabaseClient
                    .from('tickets')
                    .select('*, rooms(name), profiles:requester_id(full_name)')
                    .order('created_at', { ascending: false });
                if (error) { UI.showToast(error.message, 'danger'); return; }
                App.modules.workflow._tickets = tickets;
                document.getElementById('view-content').innerHTML = Views.app.workflow(tickets);
                if (typeof lucide !== 'undefined') lucide.createIcons();
                App.modules.workflow.switchTab('aberto');
            },

            showCreateModal: async () => {
                const { data: rooms } = await supabaseClient.from('rooms').select('id, name');
                document.getElementById('modal-root').innerHTML = Views.app.ticketModal(rooms || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            createTicket: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Processando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.from('tickets').insert([{
                    title:        document.getElementById('ticket-title').value,
                    description:  document.getElementById('ticket-desc').value,
                    room_id:      document.getElementById('ticket-room').value,
                    priority:     document.getElementById('ticket-priority').value,
                    requester_id: Auth.user.id,
                    status:       'aberto'
                }]);
                if (error) {
                    UI.showToast('Erro ao criar chamado: ' + error.message, 'danger');
                    btn.disabled = false; btn.textContent = orig;
                } else {
                    document.getElementById('ticket-modal').remove();
                    UI.showToast('Chamado aberto com sucesso!', 'success');
                    App.modules.workflow.init();
                }
            },

            showDetailModal: (ticketId) => {
                if (App.modules.workflow._isDragging) return;
                const ticket = App.modules.workflow._tickets.find(t => t.id === ticketId);
                if (!ticket) return;
                document.getElementById('modal-root').innerHTML = Views.app.ticketDetailModal(ticket);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            moveTicket: async (ticketId, newStatus) => {
                const { error } = await supabaseClient.from('tickets').update({ status: newStatus }).eq('id', ticketId);
                if (error) { UI.showToast('Erro ao mover chamado.', 'danger'); return; }
                document.getElementById('ticket-detail-modal')?.remove();
                UI.showToast('Status atualizado!', 'success');
                App.modules.workflow.init();
            },

            deleteTicket: async (ticketId) => {
                const btn = document.getElementById('btn-delete-ticket');
                if (!btn) return;
                if (btn.dataset.confirming) {
                    btn.disabled = true;
                    btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Excluindo...';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    const { data: deleted, error } = await supabaseClient
                        .from('tickets').delete().eq('id', ticketId).select('id');
                    if (error) {
                        UI.showToast('Erro ao excluir: ' + error.message, 'danger');
                        btn.disabled = false; delete btn.dataset.confirming;
                        btn.innerHTML = '<i data-lucide="trash-2"></i> Excluir Chamado';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else if (!deleted || deleted.length === 0) {
                        UI.showToast('Sem permissão para excluir este chamado.', 'danger');
                        btn.disabled = false; delete btn.dataset.confirming;
                        btn.innerHTML = '<i data-lucide="trash-2"></i> Excluir Chamado';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else {
                        document.getElementById('ticket-detail-modal')?.remove();
                        UI.showToast('Chamado excluído.', 'success');
                        App.modules.workflow.init();
                    }
                } else {
                    btn.dataset.confirming = '1';
                    btn.innerHTML = '<i data-lucide="alert-triangle"></i> Confirmar exclusão';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    setTimeout(() => {
                        if (btn.dataset.confirming) {
                            delete btn.dataset.confirming;
                            btn.innerHTML = '<i data-lucide="trash-2"></i> Excluir Chamado';
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    }, 3000);
                }
            },

            switchTab: (status) => {
                document.querySelectorAll('.kanban-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('active'));
                document.querySelector(`.kanban-tab[data-tab="${status}"]`)?.classList.add('active');
                document.querySelector(`.kanban-column[data-status="${status}"]`)?.classList.add('active');
            },

            dragStart: (event) => {
                App.modules.workflow._isDragging = true;
                event.dataTransfer.setData('ticketId', event.currentTarget.dataset.ticketId);
            },
            dragEnd: () => { setTimeout(() => { App.modules.workflow._isDragging = false; }, 100); },

            drop: async (event) => {
                event.preventDefault();
                const ticketId = event.dataTransfer.getData('ticketId');
                const newStatus = event.currentTarget.dataset.status;
                if (!ticketId || !newStatus) return;
                const { error } = await supabaseClient.from('tickets').update({ status: newStatus }).eq('id', ticketId);
                if (error) { UI.showToast('Falha ao atualizar status.', 'danger'); }
                else { App.modules.workflow.init(); }
            }
        },

        /* ── SALAS ──────────────────────────────────────────────────── */
        salas: {
            _salas: [],

            init: async () => {
                const { data: salas, error } = await supabaseClient.from('rooms').select('*').order('name');
                if (error) { UI.showToast(error.message, 'danger'); return; }
                App.modules.salas._salas = salas || [];
                document.getElementById('view-content').innerHTML = Views.app.salas(App.modules.salas._salas);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            applySort: (order) => {
                const salas = [...App.modules.salas._salas];
                if (order === 'numero') {
                    salas.sort((a, b) => {
                        if (!a.room_number && !b.room_number) return 0;
                        if (!a.room_number) return 1;
                        if (!b.room_number) return -1;
                        return a.room_number.localeCompare(b.room_number, 'pt-BR', { numeric: true });
                    });
                } else {
                    salas.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                }
                document.getElementById('salas-tbody').innerHTML = Views.app._salasRows(salas);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },
            showCreateModal: () => {
                document.getElementById('modal-root').innerHTML = Views.app.roomModal();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },
            createRoom: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Processando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.from('rooms').insert([{
                    name:        document.getElementById('room-name').value,
                    description: document.getElementById('room-description').value,
                    room_number: document.getElementById('room-number').value || null,
                    coordinator: document.getElementById('room-coordinator').value || null
                }]);
                if (error) { UI.showToast('Erro ao criar sala: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; }
                else { document.getElementById('room-modal').remove(); UI.showToast('Sala cadastrada!', 'success'); App.modules.salas.init(); }
            },
            editRoom: async (salaId) => {
                const { data: sala, error } = await supabaseClient.from('rooms').select('*').eq('id', salaId).single();
                if (error) { UI.showToast('Erro ao carregar sala.', 'danger'); return; }
                document.getElementById('modal-root').innerHTML = Views.app.salaEditModal(sala);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },
            updateRoom: async (e, salaId) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.from('rooms').update({
                    name:        document.getElementById('edit-room-name').value,
                    description: document.getElementById('edit-room-description').value,
                    room_number: document.getElementById('edit-room-number').value || null,
                    coordinator: document.getElementById('edit-room-coordinator').value || null
                }).eq('id', salaId);
                if (error) { UI.showToast('Erro ao atualizar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; }
                else { document.getElementById('sala-edit-modal').remove(); UI.showToast('Sala atualizada!', 'success'); App.modules.salas.init(); }
            },
            deleteRoom: async (btn, salaId) => {
                if (btn.dataset.confirming) {
                    btn.disabled = true; btn.textContent = '...';
                    const { error } = await supabaseClient.from('rooms').delete().eq('id', salaId);
                    if (error) {
                        UI.showToast('Erro ao excluir: ' + error.message, 'danger');
                        btn.disabled = false; delete btn.dataset.confirming;
                        btn.innerHTML = '<i data-lucide="trash-2"></i>';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else { UI.showToast('Sala excluída.', 'success'); App.modules.salas.init(); }
                } else {
                    btn.dataset.confirming = '1'; btn.textContent = 'Confirmar?';
                    setTimeout(() => {
                        if (btn.dataset.confirming) {
                            delete btn.dataset.confirming;
                            btn.innerHTML = '<i data-lucide="trash-2"></i>';
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    }, 3000);
                }
            }
        },

        /* ── USUÁRIOS ───────────────────────────────────────────────── */
        usuarios: {
            _list: [],

            init: async () => {
                const { data: usuarios, error } = await supabaseClient.from('profiles').select('*').order('full_name');
                if (error) { UI.showToast(error.message, 'danger'); return; }
                App.modules.usuarios._list = usuarios || [];
                document.getElementById('view-content').innerHTML = Views.app.usuarios(usuarios, Auth.user.id, Auth.user.role);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            updateRole: async (userId, role) => {
                const { error } = await supabaseClient.from('profiles').update({ role }).eq('id', userId);
                if (error) { UI.showToast('Erro ao atualizar permissão.', 'danger'); }
                else { UI.showToast('Permissão atualizada!', 'success'); }
            },

            showCreateModal: () => {
                if (Auth.user?.role !== 'admin') { UI.showToast('Acesso restrito a administradores.', 'danger'); return; }
                document.getElementById('modal-root').innerHTML = Views.app.usuarioCreateModal();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            createUsuario: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.innerHTML; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Criando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const full_name = document.getElementById('create-usuario-name').value.trim();
                const email     = document.getElementById('create-usuario-email').value.trim();
                const role      = document.getElementById('create-usuario-role').value;

                const user = await Auth.admin.createUser(full_name, email, role);
                if (!user) { btn.disabled = false; btn.innerHTML = orig; if (typeof lucide !== 'undefined') lucide.createIcons(); return; }

                document.getElementById('usuario-create-modal').remove();
                UI.showToast(`Usuário "${full_name}" criado com senha padrão Fundepar26.`, 'success');
                App.modules.usuarios.init();
            },

            editUsuario: (userId) => {
                const u = App.modules.usuarios._list.find(u => u.id === userId);
                if (!u) return;
                document.getElementById('modal-root').innerHTML = Views.app.usuarioEditModal(u);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            updateUsuario: async (e, userId) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.from('profiles').update({
                    full_name: document.getElementById('edit-usuario-name').value.trim(),
                    email:     document.getElementById('edit-usuario-email').value.trim()
                }).eq('id', userId);
                if (error) { UI.showToast('Erro ao atualizar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; return; }
                document.getElementById('usuario-edit-modal').remove();
                UI.showToast('Usuário atualizado!', 'success');
                App.modules.usuarios.init();
            },

            resetSenha: async (btn, userId, userName, userEmail) => {
                if (btn.dataset.confirming) {
                    btn.disabled = true; btn.textContent = '...';
                    const ok = await Auth.admin.resetPassword(userEmail);
                    if (ok) {
                        UI.showToast(`Email de redefinição de senha enviado para "${userName}".`, 'success');
                    }
                    btn.disabled = false; delete btn.dataset.confirming;
                    btn.innerHTML = '<i data-lucide="key-round"></i>';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                } else {
                    btn.dataset.confirming = '1'; btn.textContent = 'Confirmar?';
                    setTimeout(() => {
                        if (btn.dataset.confirming) {
                            delete btn.dataset.confirming;
                            btn.innerHTML = '<i data-lucide="key-round"></i>';
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    }, 3000);
                }
            },

            deleteUsuario: async (btn, userId) => {
                if (btn.dataset.confirming) {
                    btn.disabled = true; btn.textContent = '...';
                    const { data: deleted, error } = await supabaseClient.from('profiles').delete().eq('id', userId).select();
                    if (error || !deleted || deleted.length === 0) {
                        UI.showToast(error ? 'Erro: ' + error.message : 'Sem permissão. Adicione a política RLS no Supabase.', 'danger');
                        btn.disabled = false; delete btn.dataset.confirming;
                        btn.innerHTML = '<i data-lucide="trash-2"></i>';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else { UI.showToast('Usuário removido.', 'success'); App.modules.usuarios.init(); }
                } else {
                    btn.dataset.confirming = '1'; btn.textContent = 'Confirmar?';
                    setTimeout(() => {
                        if (btn.dataset.confirming) {
                            delete btn.dataset.confirming;
                            btn.innerHTML = '<i data-lucide="trash-2"></i>';
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    }, 3000);
                }
            }
        },

        /* ── PERFIL ─────────────────────────────────────────────────── */
        perfil: {
            init: () => {
                document.getElementById('view-content').innerHTML = Views.app.perfilPage(Auth.user);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            updateName: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const newName = document.getElementById('perfil-name').value.trim();
                const { error } = await supabaseClient.from('profiles').update({ full_name: newName }).eq('id', Auth.user.id);
                if (error) { UI.showToast('Erro ao salvar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; return; }
                Auth.user.full_name = newName;
                App.renderSidebarProfile();
                btn.disabled = false; btn.textContent = orig;
                UI.showToast('Nome atualizado!', 'success');
            },

            updatePassword: async (e) => {
                e.preventDefault();
                const newPass  = document.getElementById('perfil-new-pass').value;
                const confPass = document.getElementById('perfil-confirm-pass').value;
                if (newPass !== confPass) { UI.showToast('As senhas não coincidem.', 'warning'); return; }
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Alterando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.auth.updateUser({ password: newPass });
                if (error) { UI.showToast('Erro: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; return; }
                e.target.reset();
                btn.disabled = false; btn.textContent = orig;
                UI.showToast('Senha alterada com sucesso!', 'success');
            }
        },

        /* ── EQUIPAMENTOS ───────────────────────────────────────────── */
        equipamentos: {
            init: async () => {
                const { data: equipamentos, error } = await supabaseClient.from('equipment').select('*').order('name');
                if (error) { UI.showToast(error.message, 'danger'); return; }
                App.modules.equipamentos._list = equipamentos || [];
                document.getElementById('view-content').innerHTML = Views.app.equipamentos(equipamentos || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            showCreateModal: () => {
                document.getElementById('modal-root').innerHTML = Views.app.equipamentoModal();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            _list: [],

            applyFilters: () => {
                const term     = (document.getElementById('equip-search')?.value    || '').toLowerCase().trim();
                const cat      = document.getElementById('equip-filter-cat')?.value    || '';
                const status   = document.getElementById('equip-filter-status')?.value || '';
                const filtered = App.modules.equipamentos._list.filter(eq => {
                    if (cat    && (eq.categoria||'') !== cat)    return false;
                    if (status && (eq.status||'')    !== status) return false;
                    if (term) {
                        const hay = ((eq.name||'')+' '+(eq.categoria||'')+' '+(eq.observacao||'')).toLowerCase();
                        if (!hay.includes(term)) return false;
                    }
                    return true;
                });
                const tbody = document.getElementById('equipamentos-tbody');
                if (tbody) tbody.innerHTML = Views.app._equipamentosRows(filtered);
                const cnt = document.getElementById('equip-result-count');
                if (cnt) cnt.textContent = `${filtered.length} equipamento${filtered.length !== 1 ? 's' : ''}`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            create: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.from('equipment').insert([{
                    name:       document.getElementById('equip-name').value.trim(),
                    categoria:  document.getElementById('equip-categoria').value.trim() || null,
                    status:     document.getElementById('equip-status').value || 'bom',
                    observacao: document.getElementById('equip-observacao').value.trim() || null,
                    created_by: Auth.user.id
                }]);
                if (error) { UI.showToast('Erro ao cadastrar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; }
                else { document.getElementById('equipamento-modal').remove(); UI.showToast('Equipamento cadastrado!', 'success'); App.modules.equipamentos.init(); App.notifications.init(); }
            },

            editEquipamento: async (id) => {
                const { data: eq, error } = await supabaseClient.from('equipment').select('*').eq('id', id).single();
                if (error) { UI.showToast('Erro ao carregar equipamento.', 'danger'); return; }
                document.getElementById('modal-root').innerHTML = Views.app.equipamentoEditModal(eq);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            updateEquipamento: async (e, id) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.from('equipment').update({
                    name:       document.getElementById('edit-equip-name').value.trim(),
                    categoria:  document.getElementById('edit-equip-categoria').value.trim() || null,
                    status:     document.getElementById('edit-equip-status').value || 'bom',
                    observacao: document.getElementById('edit-equip-observacao').value.trim() || null,
                }).eq('id', id);
                if (error) { UI.showToast('Erro ao atualizar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; }
                else { document.getElementById('equipamento-edit-modal').remove(); UI.showToast('Equipamento atualizado!', 'success'); App.modules.equipamentos.init(); }
            },

            deleteEquipamento: async (btn, id) => {
                if (btn.dataset.confirming) {
                    btn.disabled = true; btn.textContent = '...';
                    const { error } = await supabaseClient.from('equipment').delete().eq('id', id);
                    if (error) {
                        UI.showToast('Erro ao excluir: ' + error.message, 'danger');
                        btn.disabled = false; delete btn.dataset.confirming;
                        btn.innerHTML = '<i data-lucide="trash-2"></i>';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else { UI.showToast('Equipamento excluído.', 'success'); App.modules.equipamentos.init(); }
                } else {
                    btn.dataset.confirming = '1'; btn.textContent = 'Confirmar?';
                    setTimeout(() => {
                        if (btn.dataset.confirming) {
                            delete btn.dataset.confirming;
                            btn.innerHTML = '<i data-lucide="trash-2"></i>';
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    }, 3000);
                }
            }
        },

        /* ── RASTREIO ───────────────────────────────────────────────── */
        rastreio: {
            _data: [],
            _filteredData: [],

            init: async () => {
                const [
                    { data: allEquipment, error },
                    { data: movements },
                    { data: rooms },
                    { data: profilesList }
                ] = await Promise.all([
                    supabaseClient.from('equipment').select('id, name, categoria, status, observacao').order('name'),
                    supabaseClient.from('asset_movements')
                        .select('equipment_id, equipment(name,categoria,status,observacao), asset_number, serial_number, received_by, moved_at, destination_room_id, moved_by')
                        .order('moved_at', { ascending: false }),
                    supabaseClient.from('rooms').select('id, name'),
                    supabaseClient.from('profiles').select('id, full_name')
                ]);

                if (error) { UI.showToast(error.message, 'danger'); return; }

                const roomMap    = Object.fromEntries((rooms        || []).map(r => [r.id, r]));
                const profileMap = Object.fromEntries((profilesList || []).map(p => [p.id, p]));

                // Deduplica por patrimônio físico (asset_number), não por tipo.
                // Mesma lógica do mapa de salas — movimentos já vêm ordenados DESC.
                const seen = new Set();
                const data = [];
                (movements || []).forEach(m => {
                    const key = m.asset_number
                        ? `pat_${m.asset_number}`
                        : m.serial_number
                            ? `eq_${m.equipment_id}_ser_${m.serial_number}`
                            : `eq_${m.equipment_id}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    data.push({
                        equipment_id:        m.equipment_id,
                        equipment:           m.equipment,
                        categoria:           m.equipment?.categoria  || null,
                        status:              m.equipment?.status     || null,
                        observacao:          m.equipment?.observacao || null,
                        asset_number:        m.asset_number          || null,
                        serial_number:       m.serial_number         || null,
                        received_by:         m.received_by           || null,
                        moved_at:            m.moved_at              || null,
                        destination_room_id: m.destination_room_id   || null,
                        moved_by:            m.moved_by              || null,
                        room:    roomMap[m.destination_room_id]      || null,
                        profile: profileMap[m.moved_by]              || null,
                    });
                });

                // Adiciona equipamentos que nunca foram movimentados
                const movedIds = new Set(data.map(d => d.equipment_id));
                (allEquipment || []).forEach(eq => {
                    if (movedIds.has(eq.id)) return;
                    data.push({
                        equipment_id: eq.id, equipment: { name: eq.name },
                        categoria: eq.categoria || null, status: eq.status || null,
                        observacao: eq.observacao || null,
                        asset_number: null, serial_number: null, received_by: null,
                        moved_at: null, destination_room_id: null, moved_by: null,
                        room: null, profile: null,
                    });
                });

                App.modules.rastreio._data         = data;
                App.modules.rastreio._filteredData = data;

                const uniqueRooms = Object.values(
                    Object.fromEntries(data.filter(d => d.room).map(d => [d.destination_room_id, d.room]))
                ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

                const categorias = [...new Set(data.filter(d => d.categoria).map(d => d.categoria))].sort();

                document.getElementById('view-content').innerHTML = Views.app.rastreio(data, uniqueRooms, categorias);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            applyFilters: () => {
                const term      = (document.getElementById('rastreio-search')?.value         || '').toLowerCase().trim();
                const roomId    =  document.getElementById('rastreio-filter-room')?.value    || '';
                const categoria =  document.getElementById('rastreio-filter-cat')?.value     || '';
                const status    =  document.getElementById('rastreio-filter-status')?.value  || '';
                const sort      =  document.getElementById('rastreio-sort')?.value           || 'az';

                let filtered = App.modules.rastreio._data.filter(d => {
                    if (roomId === '__sem_sala__') { if (d.room) return false; }
                    else if (roomId && d.destination_room_id !== roomId) return false;
                    if (categoria && (d.categoria||'') !== categoria) return false;
                    if (status    && (d.status   ||'') !== status)    return false;
                    if (term) {
                        const hay = [(d.equipment?.name||''),(d.asset_number||''),(d.serial_number||''),(d.categoria||''),(d.received_by||''),(d.observacao||'')]
                            .join(' ').toLowerCase();
                        if (!hay.includes(term)) return false;
                    }
                    return true;
                });

                if      (sort === 'az')  filtered.sort((a,b) => (a.equipment?.name||'').localeCompare(b.equipment?.name||'', 'pt-BR'));
                else if (sort === 'za')  filtered.sort((a,b) => (b.equipment?.name||'').localeCompare(a.equipment?.name||'', 'pt-BR'));
                else if (sort === 'pat') filtered.sort((a,b) => (a.asset_number||'zzz').localeCompare(b.asset_number||'zzz','pt-BR',{numeric:true}));
                else if (sort === 'sala') filtered.sort((a,b) => (a.room?.name||'zzz').localeCompare(b.room?.name||'zzz','pt-BR'));
                else if (sort === 'cat') filtered.sort((a,b) => (a.categoria||'zzz').localeCompare(b.categoria||'zzz','pt-BR'));

                App.modules.rastreio._filteredData = filtered;

                const tbody = document.getElementById('rastreio-tbody');
                if (tbody) { tbody.innerHTML = Views.app._rastreioRows(filtered); if (typeof lucide !== 'undefined') lucide.createIcons(); }
                const countEl = document.getElementById('rastreio-result-count');
                if (countEl) countEl.textContent = `${filtered.length} equipamento${filtered.length !== 1 ? 's' : ''}`;
            },

            exportExcel: () => {
                if (typeof XLSX === 'undefined') { UI.showToast('Biblioteca não carregada.', 'danger'); return; }
                const rows = App.modules.rastreio._filteredData;
                if (rows.length === 0) { UI.showToast('Nenhum equipamento para exportar.', 'warning'); return; }

                const wsData = [
                    ['Equipamento', 'Categoria', 'Status', 'Nº Patrimônio', 'Nº Série', 'Localização Atual', 'Com quem está', 'Última Movimentação', 'Observação'],
                    ...rows.map(d => [
                        d.equipment?.name                  || '—',
                        d.categoria                        || '—',
                        d.status                           || '—',
                        formatAssetNumber(d.asset_number)  || '—',
                        d.serial_number                    || '—',
                        d.room?.name                       || 'Não localizado',
                        d.received_by                      || '—',
                        d.moved_at ? new Date(d.moved_at).toLocaleString('pt-BR') : 'Nunca movimentado',
                        d.observacao                       || '—',
                    ])
                ];

                const ws = XLSX.utils.aoa_to_sheet(wsData);
                ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 30 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Rastreio');
                XLSX.writeFile(wb, `rastreio_${new Date().toISOString().slice(0, 10)}.xlsx`);
                UI.showToast('Arquivo exportado!', 'success');
            },

            showHistory: async (equipmentId, equipmentName) => {
                const { data: movements, error } = await supabaseClient
                    .from('asset_movements')
                    .select('*, origin_room:origin_room_id(name), destination_room:destination_room_id(name), profile:moved_by(full_name)')
                    .eq('equipment_id', equipmentId)
                    .order('moved_at', { ascending: false });

                if (error) { UI.showToast('Erro ao carregar histórico.', 'danger'); return; }
                document.getElementById('modal-root').innerHTML = Views.app.rastreioHistoryModal(equipmentName, movements || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            filter: (term) => { App.modules.rastreio.applyFilters(); }
        },

        /* ── MOVIMENTAÇÕES ──────────────────────────────────────────── */
        movimentacoes: {
            _equipment: [],
            _rooms: [],
            _lastData: [],
            _filteredData: [],
            _importRows: [],
            _page: 1,
            _pageSize: 25,

            renderPage: () => {
                const mod   = App.modules.movimentacoes;
                const start = (mod._page - 1) * mod._pageSize;
                const slice = mod._filteredData.slice(start, start + mod._pageSize);

                const tbody = document.getElementById('movimentacoes-tbody');
                if (tbody) { tbody.innerHTML = Views.app.movimentacoesRows(slice); if (typeof lucide !== 'undefined') lucide.createIcons(); }

                const pag = document.getElementById('mov-pagination');
                if (pag) { pag.innerHTML = Views.app.movimentacoesPagination(mod._page, mod._filteredData.length, mod._pageSize); if (typeof lucide !== 'undefined') lucide.createIcons(); }

                const countEl = document.getElementById('filter-result-count');
                if (countEl) countEl.textContent = `${mod._filteredData.length} resultado${mod._filteredData.length !== 1 ? 's' : ''}`;
            },

            prevPage: () => { if (App.modules.movimentacoes._page > 1) { App.modules.movimentacoes._page--; App.modules.movimentacoes.renderPage(); window.scrollTo(0, 0); } },
            nextPage: () => {
                const mod = App.modules.movimentacoes;
                if (mod._page < Math.ceil(mod._filteredData.length / mod._pageSize)) { mod._page++; mod.renderPage(); window.scrollTo(0, 0); }
            },

            openImportPicker: () => {
                const input = document.getElementById('import-file-input');
                if (input) { input.value = ''; input.click(); }
            },

            handleImportFile: async (input) => {
                if (Auth.user?.role !== 'admin') { UI.showToast('Acesso restrito a administradores.', 'danger'); return; }
                const file = input.files[0];
                if (!file) return;

                if (typeof XLSX === 'undefined') { UI.showToast('Biblioteca não carregada.', 'danger'); return; }

                // Fetch equipment and rooms for lookup
                const [{ data: equipment }, { data: rooms }] = await Promise.all([
                    supabaseClient.from('equipment').select('id, name'),
                    supabaseClient.from('rooms').select('id, name')
                ]);

                const normalize = s => (s || '').toString().trim().toLowerCase();
                const eqByName   = Object.fromEntries((equipment || []).map(e => [normalize(e.name), e]));
                const roomByName = Object.fromEntries((rooms     || []).map(r => [normalize(r.name), r]));

                // Parse file
                const buf  = await file.arrayBuffer();
                const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
                const ws   = wb.Sheets[wb.SheetNames[0]];
                const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });

                const parseDate = (val) => {
                    if (!val) return null;
                    if (val instanceof Date) return val;
                    // DD/MM/AAAA or DD/MM/AAAA HH:MM
                    const s = val.toString().trim();
                    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
                    if (m) return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0));
                    const d = new Date(s);
                    return isNaN(d) ? null : d;
                };

                const rows = raw.map((row, i) => {
                    const equipmentName = (row['Equipamento'] || '').toString().trim();
                    const serialNumber  = (row['Nº Série']    || '').toString().trim() || null;
                    const assetNumber   = (row['Nº Patrimônio']|| '').toString().trim() || null;
                    const originName    = (row['Origem']      || '').toString().trim();
                    const destName      = (row['Destino']     || '').toString().trim();
                    const receivedBy    = (row['Recebedor']   || '').toString().trim() || null;
                    const dateRaw       = row['Data / Hora'];
                    const movedAt       = parseDate(dateRaw);

                    const eq     = eqByName[normalize(equipmentName)];
                    const origin = originName ? roomByName[normalize(originName)] : null;
                    const dest   = destName   ? roomByName[normalize(destName)]   : null;

                    const errors   = [];
                    const warnings = [];

                    if (!equipmentName)    errors.push('Equipamento não informado');
                    else if (!eq)          errors.push('Equipamento não encontrado no cadastro');
                    if (!destName)         errors.push('Destino não informado');
                    else if (!dest)        errors.push('Sala de destino não encontrada no cadastro');
                    if (originName && !origin) warnings.push('Sala de origem não encontrada — ficará em branco');
                    if (!movedAt)              warnings.push('Data inválida ou ausente — será usada a data/hora atual');

                    const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warn' : 'ok';

                    return {
                        equipmentName, serialNumber, assetNumber,
                        originName, destName, receivedBy,
                        equipmentId:   eq?.id     || null,
                        originId:      origin?.id || null,
                        destId:        dest?.id   || null,
                        movedAt,
                        movedAtDisplay: movedAt ? movedAt.toLocaleString('pt-BR') : null,
                        status, errors, warnings
                    };
                });

                App.modules.movimentacoes._importRows = rows;
                document.getElementById('modal-root').innerHTML = Views.app.importPreviewModal(rows);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            confirmImport: async () => {
                const rows = App.modules.movimentacoes._importRows.filter(r => r.status !== 'error');
                if (rows.length === 0) { UI.showToast('Nenhuma linha válida para importar.', 'warning'); return; }

                const btn = document.querySelector('#import-preview-modal .btn-primary:last-child');
                if (btn) { btn.disabled = true; btn.textContent = 'Importando...'; }

                const inserts = rows.map(r => ({
                    equipment_id:        r.equipmentId,
                    serial_number:       r.serialNumber  || null,
                    asset_number:        r.assetNumber   || null,
                    origin_room_id:      r.originId      || null,
                    destination_room_id: r.destId,
                    moved_by:            Auth.user.id,
                    received_by:         r.receivedBy    || null,
                    moved_at:            r.movedAt ? r.movedAt.toISOString() : new Date().toISOString()
                }));

                const { error } = await supabaseClient.from('asset_movements').insert(inserts);

                if (error) {
                    UI.showToast('Erro ao importar: ' + error.message, 'danger');
                    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar Importação'; }
                    return;
                }

                document.getElementById('import-preview-modal').remove();
                UI.showToast(`${rows.length} movimentaç${rows.length !== 1 ? 'ões importadas' : 'ão importada'} com sucesso!`, 'success');
                App.modules.movimentacoes.init();
            },

            applyFilters: () => {
                const dateFrom    = document.getElementById('filter-date-from')?.value;
                const dateTo      = document.getElementById('filter-date-to')?.value;
                const equipmentId = document.getElementById('filter-equipment')?.value;
                const originId    = document.getElementById('filter-origin')?.value;
                const destId      = document.getElementById('filter-dest')?.value;
                const responsible = document.getElementById('filter-responsible')?.value;

                const filtered = App.modules.movimentacoes._lastData.filter(m => {
                    const d = new Date(m.moved_at);
                    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
                    if (dateTo   && d > new Date(dateTo   + 'T23:59:59')) return false;
                    if (equipmentId && m.equipment_id      !== equipmentId) return false;
                    if (originId    && m.origin_room_id    !== originId)    return false;
                    if (destId      && m.destination_room_id !== destId)    return false;
                    if (responsible && m.moved_by          !== responsible)  return false;
                    return true;
                });

                App.modules.movimentacoes._filteredData = filtered;
                App.modules.movimentacoes._page = 1;
                App.modules.movimentacoes.renderPage();
            },

            clearFilters: () => {
                ['filter-date-from','filter-date-to','filter-equipment','filter-origin','filter-dest','filter-responsible']
                    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                App.modules.movimentacoes.applyFilters();
            },

            exportExcel: () => {
                if (typeof XLSX === 'undefined') {
                    UI.showToast('Biblioteca de exportação não carregada.', 'danger');
                    return;
                }
                const rows = App.modules.movimentacoes._filteredData;
                if (rows.length === 0) {
                    UI.showToast('Nenhuma movimentação para exportar.', 'warning');
                    return;
                }

                const wsData = [
                    ['Equipamento', 'Nº Série', 'Nº Patrimônio', 'Origem', 'Destino', 'Responsável', 'Com quem está', 'Data / Hora'],
                    ...rows.map(m => [
                        m.equipment?.name        || '—',
                        m.serial_number          || '—',
                        formatAssetNumber(m.asset_number) || '—',
                        m.origin?.name           || '—',
                        m.destination?.name      || '—',
                        m.profiles?.full_name    || '—',
                        m.received_by            || '—',
                        new Date(m.moved_at).toLocaleString('pt-BR')
                    ])
                ];

                const ws = XLSX.utils.aoa_to_sheet(wsData);

                ws['!cols'] = [
                    { wch: 30 }, { wch: 18 }, { wch: 18 },
                    { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 20 }
                ];

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');

                const fileName = `movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
                XLSX.writeFile(wb, fileName);
                UI.showToast('Arquivo exportado com sucesso!', 'success');
            },

            init: async () => {
                const [
                    { data: movements, error },
                    { data: rooms },
                    { data: profilesList }
                ] = await Promise.all([
                    supabaseClient.from('asset_movements')
                        .select('*, equipment(name)')
                        .order('moved_at', { ascending: false }),
                    supabaseClient.from('rooms').select('id, name'),
                    supabaseClient.from('profiles').select('id, full_name')
                ]);

                if (error) { UI.showToast(error.message, 'danger'); return; }

                const roomMap    = Object.fromEntries((rooms        || []).map(r => [r.id, r]));
                const profileMap = Object.fromEntries((profilesList || []).map(p => [p.id, p]));

                const movimentacoes = (movements || []).map(m => ({
                    ...m,
                    origin:      roomMap[m.origin_room_id]      || null,
                    destination: roomMap[m.destination_room_id] || null,
                    profiles:    profileMap[m.moved_by]         || null,
                    editedBy:    profileMap[m.edited_by]        || null
                }));

                App.modules.movimentacoes._lastData     = movimentacoes;
                App.modules.movimentacoes._filteredData = movimentacoes;
                App.modules.movimentacoes._page         = 1;

                // Unique equipment list for filter dropdown
                const eqMap = new Map();
                movimentacoes.forEach(m => { if (m.equipment_id && m.equipment?.name) eqMap.set(m.equipment_id, { id: m.equipment_id, name: m.equipment.name }); });
                const uniqueEquipment = [...eqMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

                document.getElementById('view-content').innerHTML = Views.app.movimentacoes(movimentacoes, uniqueEquipment, rooms || [], profilesList || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            showCreateModal: async (prefillAsset = null, prefillOriginId = null, prefillOriginName = null) => {
                const [{ data: equipment }, { data: rooms }] = await Promise.all([
                    supabaseClient.from('equipment').select('id, name').order('name'),
                    supabaseClient.from('rooms').select('id, name').order('name')
                ]);
                App.modules.movimentacoes._equipment = equipment || [];
                App.modules.movimentacoes._rooms     = rooms     || [];
                document.getElementById('modal-root').innerHTML = Views.app.movimentacaoModal(equipment || [], rooms || [], prefillAsset, prefillOriginId, prefillOriginName);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            lookupAndFillOrigin: async (rawValue) => {
                const digits = (rawValue || '').replace(/\D/g, '');
                if (digits.length !== 12) return;
                const assetNumber = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}.${digits.slice(9,12)}`;

                const originIdInput   = document.getElementById('mov-origin-id');
                const originTextInput = document.querySelector('#wrap-mov-origin input[type="text"]');
                if (!originIdInput || originIdInput.value) return; // já preenchido, não sobrescrever

                const { data } = await supabaseClient
                    .from('asset_movements')
                    .select('destination_room_id, destination_room:destination_room_id(id, name)')
                    .eq('asset_number', assetNumber)
                    .order('moved_at', { ascending: false })
                    .limit(1);

                if (data && data.length > 0 && data[0].destination_room) {
                    const room = data[0].destination_room;
                    originIdInput.value = room.id;
                    if (originTextInput) originTextInput.value = room.name;
                    UI.showToast(`Origem preenchida automaticamente: ${room.name}`, 'success');
                }
            },

            showEditModal: async (movId) => {
                const movement = App.modules.movimentacoes._lastData.find(m => m.id === movId);
                if (!movement) return;
                const { data: rooms } = await supabaseClient.from('rooms').select('id, name').order('name');
                App.modules.movimentacoes._rooms = rooms || [];
                document.getElementById('modal-root').innerHTML = Views.app.movimentacaoEditModal(movement, rooms || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            update: async (e, movId) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const originRoomId = document.getElementById('edit-mov-origin-id').value;
                const destRoomId   = document.getElementById('edit-mov-destination-id').value;
                const editReason   = document.getElementById('edit-mov-reason').value.trim();

                const originRoom = App.modules.movimentacoes._rooms.find(r => r.id === originRoomId);
                const destRoom   = App.modules.movimentacoes._rooms.find(r => r.id === destRoomId);

                if (!originRoom) { UI.showToast('Selecione a sala de origem.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }
                if (!destRoom)   { UI.showToast('Selecione a sala de destino.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }
                if (originRoomId === destRoomId) { UI.showToast('A sala de origem e destino não podem ser iguais.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }
                if (!editReason) { UI.showToast('A justificativa é obrigatória.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }

                const movedAtVal   = document.getElementById('edit-mov-date').value;
                const rawEditAsset = document.getElementById('edit-mov-asset').value.trim();
                const editDigits   = rawEditAsset.replace(/\D/g, '');
                const editAsset    = editDigits.length === 12
                    ? `${editDigits.slice(0,3)}.${editDigits.slice(3,6)}.${editDigits.slice(6,9)}.${editDigits.slice(9,12)}`
                    : rawEditAsset || null;

                const { error } = await supabaseClient.from('asset_movements').update({
                    serial_number:       document.getElementById('edit-mov-serial').value.trim() || null,
                    asset_number:        editAsset,
                    origin_room_id:      originRoom.id,
                    destination_room_id: destRoom.id,
                    received_by:         document.getElementById('edit-mov-received-by').value.trim() || null,
                    moved_at:            movedAtVal ? new Date(movedAtVal).toISOString() : undefined,
                    is_edited:           true,
                    edited_by:           Auth.user.id,
                    edited_at:           new Date().toISOString(),
                    edit_reason:         editReason
                }).eq('id', movId);

                if (error) { UI.showToast('Erro ao atualizar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; return; }

                await supabaseClient.from('movement_edits').insert([{
                    movement_id: movId,
                    edited_by:   Auth.user.id,
                    edited_at:   new Date().toISOString(),
                    edit_reason: editReason
                }]);

                document.getElementById('movimentacao-edit-modal').remove();
                UI.showToast('Movimentação atualizada!', 'success');
                App.modules.movimentacoes.init();
            },

            showEditInfo: async (movId) => {
                const [
                    { data: logs, error },
                    { data: profilesList }
                ] = await Promise.all([
                    supabaseClient.from('movement_edits')
                        .select('*')
                        .eq('movement_id', movId)
                        .order('edited_at', { ascending: false }),
                    supabaseClient.from('profiles').select('id, full_name')
                ]);
                if (error) { UI.showToast('Erro ao carregar histórico.', 'danger'); return; }
                const profileMap = Object.fromEntries((profilesList || []).map(p => [p.id, p]));
                const enrichedLogs = (logs || []).map(log => ({
                    ...log,
                    editor_name: profileMap[log.edited_by]?.full_name || '—'
                }));
                document.getElementById('modal-root').innerHTML = Views.app.movimentacaoEditInfoModal(enrichedLogs);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            delete: async (btn, movId) => {
                if (btn.dataset.confirming) {
                    btn.disabled = true; btn.textContent = '...';
                    const { error } = await supabaseClient.from('asset_movements').delete().eq('id', movId);
                    if (error) {
                        UI.showToast('Erro ao excluir: ' + error.message, 'danger');
                        btn.disabled = false; delete btn.dataset.confirming;
                        btn.innerHTML = '<i data-lucide="trash-2"></i>';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else { UI.showToast('Movimentação excluída.', 'success'); App.modules.movimentacoes.init(); }
                } else {
                    btn.dataset.confirming = '1'; btn.textContent = 'Confirmar?';
                    setTimeout(() => {
                        if (btn.dataset.confirming) {
                            delete btn.dataset.confirming;
                            btn.innerHTML = '<i data-lucide="trash-2"></i>';
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        }
                    }, 3000);
                }
            },

            fillEquipmentData: (name) => {
                const eq = App.modules.movimentacoes._equipment.find(e => e.name === name);
                document.getElementById('mov-equipment-id').value = eq ? eq.id : '';
            },

            create: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Registrando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                const equipmentId  = document.getElementById('mov-equipment-id').value;
                const originRoomId = document.getElementById('mov-origin-id').value;
                const destRoomId   = document.getElementById('mov-destination-id').value;

                if (!equipmentId)  { UI.showToast('Selecione um equipamento da lista.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }
                if (!originRoomId) { UI.showToast('Selecione a sala de origem.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }
                if (!destRoomId)   { UI.showToast('Selecione a sala de destino.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }

                const originRoom = App.modules.movimentacoes._rooms.find(r => r.id === originRoomId);
                const destRoom   = App.modules.movimentacoes._rooms.find(r => r.id === destRoomId);

                if (!originRoom || !destRoom) { UI.showToast('Sala não encontrada. Tente novamente.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }
                if (originRoomId === destRoomId) { UI.showToast('A sala de origem e destino não podem ser iguais.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }

                const serialNumber = document.getElementById('mov-serial').value || null;
                const rawAsset     = document.getElementById('mov-asset-number').value || '';
                const assetDigits  = rawAsset.replace(/\D/g, '');
                const assetNumber  = assetDigits.length === 12
                    ? `${assetDigits.slice(0,3)}.${assetDigits.slice(3,6)}.${assetDigits.slice(6,9)}.${assetDigits.slice(9,12)}`
                    : rawAsset || null;
                const receivedBy   = document.getElementById('mov-received-by').value.trim() || null;
                const movedAt      = new Date().toISOString();

                // Validação: patrimônio já está no destino selecionado?
                if (assetNumber) {
                    const { data: lastMov } = await supabaseClient
                        .from('asset_movements')
                        .select('destination_room_id')
                        .eq('asset_number', assetNumber)
                        .order('moved_at', { ascending: false })
                        .limit(1);

                    if (lastMov && lastMov.length > 0) {
                        if (lastMov[0].destination_room_id === destRoomId) {
                            UI.showToast('Este patrimônio já está na sala de destino selecionada.', 'warning');
                            btn.disabled = false; btn.textContent = orig;
                            return;
                        }
                    }
                }

                const itemStatus = document.getElementById('mov-item-status').value || null;
                const comentario = document.getElementById('mov-comentario').value.trim() || null;

                const { error } = await supabaseClient.from('asset_movements').insert([{
                    equipment_id:        equipmentId,
                    serial_number:       serialNumber,
                    asset_number:        assetNumber,
                    origin_room_id:      originRoom.id,
                    destination_room_id: destRoom.id,
                    moved_by:            Auth.user.id,
                    received_by:         receivedBy,
                    moved_at:            movedAt,
                    item_status:         itemStatus,
                    comentario:          comentario
                }]);

                // Atualiza status do equipamento se informado
                if (!error && itemStatus) {
                    await supabaseClient.from('equipment').update({ status: itemStatus }).eq('id', equipmentId);
                }

                if (error) { UI.showToast('Erro ao registrar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; return; }

                // Atualiza localização atual do equipamento (upsert silencioso)
                await supabaseClient.from('equipment_locations').upsert({
                    equipment_id:    equipmentId,
                    asset_number:    assetNumber,
                    serial_number:   serialNumber,
                    current_room_id: destRoom.id,
                    moved_by:        Auth.user.id,
                    received_by:     receivedBy,
                    moved_at:        movedAt
                }, { onConflict: 'equipment_id' });

                document.getElementById('movimentacao-modal').remove();
                UI.showToast('Movimentação registrada!', 'success');
                App.modules.movimentacoes.init();
                App.notifications.init();
            }
        },

        /* ── MAPA DE SALAS ──────────────────────────────────────────── */
        mapaSalas: {
            _rooms: [],

            init: async () => {
                const [
                    { data: rooms, error },
                    { data: movements }
                ] = await Promise.all([
                    supabaseClient.from('rooms').select('*').order('name'),
                    supabaseClient.from('asset_movements')
                        .select('equipment_id, equipment(name), asset_number, serial_number, received_by, moved_at, destination_room_id')
                        .order('moved_at', { ascending: false })
                ]);

                if (error) { UI.showToast(error.message, 'danger'); return; }

                // Deduplica por patrimônio individual (asset_number), não por tipo de equipamento.
                // Chave: asset_number se existir, senão equipment_id+serial_number, senão equipment_id.
                // Movimentos já vêm ordenados DESC por moved_at, então o primeiro encontrado = mais recente.
                const seen = new Set();
                const locationsByRoom = {};
                (movements || []).forEach(m => {
                    const key = m.asset_number
                        ? `pat_${m.asset_number}`
                        : m.serial_number
                            ? `eq_${m.equipment_id}_ser_${m.serial_number}`
                            : `eq_${m.equipment_id}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    const rid = m.destination_room_id;
                    if (!rid) return;
                    if (!locationsByRoom[rid]) locationsByRoom[rid] = [];
                    locationsByRoom[rid].push({
                        name:          m.equipment?.name || '—',
                        asset_number:  m.asset_number    || null,
                        serial_number: m.serial_number   || null,
                        received_by:   m.received_by     || null,
                        moved_at:      m.moved_at        || null
                    });
                });

                const roomsWithItems = (rooms || []).map(r => ({
                    ...r,
                    items: locationsByRoom[r.id] || []
                }));

                App.modules.mapaSalas._rooms = roomsWithItems;
                document.getElementById('view-content').innerHTML = Views.app.mapaSalas(roomsWithItems);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            showRoomDetail: (roomId) => {
                const room = App.modules.mapaSalas._rooms.find(r => r.id === roomId);
                if (!room) return;
                document.getElementById('modal-root').innerHTML = Views.app.salaDetailModal(room);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            exportExcel: (roomId) => {
                if (typeof XLSX === 'undefined') { UI.showToast('Biblioteca não carregada.', 'danger'); return; }
                const room = App.modules.mapaSalas._rooms.find(r => r.id === roomId);
                if (!room) return;

                const wsData = [
                    ['Equipamento', 'Nº Patrimônio', 'Nº Série', 'Recebedor', 'Última Movimentação'],
                    ...room.items.map(item => [
                        item.name                           || '—',
                        formatAssetNumber(item.asset_number) || '—',
                        item.serial_number                  || '—',
                        item.received_by                    || '—',
                        item.moved_at ? new Date(item.moved_at).toLocaleString('pt-BR') : '—'
                    ])
                ];

                const ws = XLSX.utils.aoa_to_sheet(wsData);
                ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 22 }];
                const wb = XLSX.utils.book_new();
                const sheetName = room.name.slice(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
                const safeName = room.name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
                XLSX.writeFile(wb, `sala_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
                UI.showToast(`Exportado: ${room.items.length} equipamento${room.items.length !== 1 ? 's' : ''}`, 'success');
            }
        }
    },

    /* ── AUTH / PROFILE ─────────────────────────────────────────────── */

    loadLogin: () => {
        document.getElementById('auth-container').innerHTML = Views.auth.login();
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const orig = btn.textContent;
            btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            btn.disabled = true;
            await Auth.signIn(document.getElementById('login-email').value, document.getElementById('login-password').value);
            if (document.getElementById('login-form')) { btn.textContent = orig; btn.disabled = false; }
        });
        document.getElementById('go-to-register').addEventListener('click', (e) => { e.preventDefault(); App.loadRegister(); });
    },

    loadRegister: () => {
        document.getElementById('auth-container').innerHTML = Views.auth.register();
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const orig = btn.textContent;
            btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            btn.disabled = true;
            await Auth.signUp(document.getElementById('register-name').value, document.getElementById('register-email').value, document.getElementById('register-password').value);
            if (document.getElementById('register-form')) { btn.textContent = orig; btn.disabled = false; }
        });
        document.getElementById('go-to-login').addEventListener('click', (e) => { e.preventDefault(); App.loadLogin(); });
    },

    renderSidebarProfile: () => {
        const container = document.getElementById('sidebar-profile');
        if (container && Auth.user) {
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(Auth.user.full_name || 'U')}&background=0c4a6e&color=fff`;
            container.innerHTML = `
                <a href="#perfil" class="sidebar-profile-link" title="Ver meu perfil">
                    <img src="${avatarUrl}" alt="Avatar" class="avatar">
                    <div class="profile-info">
                        <div class="name" title="${escapeHtml(Auth.user.full_name)}">${escapeHtml(Auth.user.full_name)}</div>
                        <div class="role">${escapeHtml(Auth.user.role) || 'Usuário'}</div>
                    </div>
                </a>
                <button class="btn-logout" onclick="Auth.signOut()" title="Sair do Sistema">
                    <i data-lucide="log-out"></i>
                </button>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    },

    updateActiveNavLink: (route) => {
        document.querySelectorAll('.sidebar-menu ul li').forEach(li => li.classList.remove('active'));
        const link = document.querySelector(`.sidebar-menu a[href="${route}"]`);
        if (link) link.parentElement.classList.add('active');
    }
};

const Autocomplete = {
    show: (id) => {
        const list = document.getElementById(id + '-list');
        if (!list) return;
        list.querySelectorAll('.autocomplete-item').forEach(el => el.classList.remove('hidden'));
        list.classList.add('open');
    },
    hide: (id) => {
        setTimeout(() => {
            const list = document.getElementById(id + '-list');
            if (list) list.classList.remove('open');
        }, 200);
    },
    filter: (id) => {
        const wrapper = document.getElementById(id);
        const list    = document.getElementById(id + '-list');
        if (!wrapper || !list) return;
        const q = (wrapper.querySelector('input[type="text"]')?.value || '').toLowerCase().trim();
        list.classList.add('open');
        let visible = 0;
        list.querySelectorAll('.autocomplete-item').forEach(el => {
            const match = !q || el.dataset.label.toLowerCase().includes(q);
            el.classList.toggle('hidden', !match);
            if (match) visible++;
        });
        let empty = list.querySelector('.autocomplete-empty');
        if (!empty) { empty = document.createElement('div'); empty.className = 'autocomplete-empty'; empty.textContent = 'Nenhum resultado.'; list.appendChild(empty); }
        empty.style.display = visible === 0 ? '' : 'none';
    },
    pick: (id, value, label, hiddenId) => {
        const wrapper = document.getElementById(id);
        if (wrapper) { const inp = wrapper.querySelector('input[type="text"]'); if (inp) inp.value = label; }
        if (hiddenId) { const h = document.getElementById(hiddenId); if (h) h.value = value; }
        const list = document.getElementById(id + '-list');
        if (list) list.classList.remove('open');
    }
};

/* ── DARK MODE ─────────────────────────────────────────────────────── */
App.darkMode = {
    init: () => {
        if (localStorage.getItem('dark_mode') === '1') {
            document.body.classList.add('dark');
            App.darkMode._icon(true);
        }
    },
    toggle: () => {
        const dark = document.body.classList.toggle('dark');
        localStorage.setItem('dark_mode', dark ? '1' : '0');
        App.darkMode._icon(dark);
    },
    _icon: (dark) => {
        const btn = document.getElementById('dark-mode-btn');
        if (!btn) return;
        btn.innerHTML = `<i data-lucide="${dark ? 'sun' : 'moon'}"></i>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

/* ── NOTIFICATIONS ──────────────────────────────────────────────────── */
App.notifications = {
    _data: [],

    _relativeTime: (date) => {
        const diff = Date.now() - date;
        const min = Math.floor(diff / 60000);
        const h   = Math.floor(diff / 3600000);
        const d   = Math.floor(diff / 86400000);
        if (min < 1)  return 'Agora mesmo';
        if (min < 60) return `${min} min atrás`;
        if (h < 24)   return `${h}h atrás`;
        if (d < 7)    return `${d}d atrás`;
        return date.toLocaleDateString('pt-BR');
    },

    init: async () => {
        const [
            { data: movements },
            { data: equipment },
            { data: profiles }
        ] = await Promise.all([
            supabaseClient.from('asset_movements')
                .select('id, equipment(name), moved_by, moved_at, destination_room:destination_room_id(name), origin_room:origin_room_id(name), asset_number, serial_number, received_by')
                .order('moved_at', { ascending: false })
                .limit(15),
            supabaseClient.from('equipment')
                .select('id, name, created_by, created_at')
                .order('created_at', { ascending: false })
                .limit(10),
            supabaseClient.from('profiles').select('id, full_name')
        ]);

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        const lastSeen   = localStorage.getItem('notif_last_seen') ? new Date(localStorage.getItem('notif_last_seen')) : null;

        const items = [
            ...(movements || []).map(m => ({
                id:    'mov_' + m.id,
                refId: m.id,
                type:  'movement',
                actor: profileMap[m.moved_by]?.full_name || 'Alguém',
                text:  `registrou movimentação de <strong>${escapeHtml(m.equipment?.name || 'equipamento')}</strong> para <strong>${escapeHtml(m.destination_room?.name || '—')}</strong>`,
                date:  new Date(m.moved_at),
                data:  m
            })),
            ...(equipment || []).map(e => ({
                id:    'eq_' + e.id,
                refId: e.id,
                type:  'equipment',
                actor: profileMap[e.created_by]?.full_name || 'Alguém',
                text:  `cadastrou o equipamento <strong>${escapeHtml(e.name)}</strong>`,
                date:  new Date(e.created_at),
                data:  e
            }))
        ].sort((a, b) => b.date - a.date).slice(0, 25);

        App.notifications._data = items;

        const unseen = lastSeen ? items.filter(i => i.date > lastSeen).length : items.length;
        const badge  = document.getElementById('notif-badge');
        if (badge) {
            badge.textContent = unseen > 9 ? '9+' : String(unseen);
            badge.style.display = unseen > 0 ? '' : 'none';
        }
    },

    toggle: () => {
        const panel = document.getElementById('notifications-panel');
        if (!panel) return;
        panel.classList.contains('hidden') ? App.notifications.open() : App.notifications.close();
    },

    open: () => {
        const panel    = document.getElementById('notifications-panel');
        const backdrop = document.getElementById('notifications-backdrop');
        if (!panel) return;

        localStorage.setItem('notif_last_seen', new Date().toISOString());
        const badge = document.getElementById('notif-badge');
        if (badge) badge.style.display = 'none';

        panel.innerHTML = Views.app.notificationsPanel(App.notifications._data);
        panel.classList.remove('hidden');
        if (backdrop) backdrop.classList.add('active');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    close: () => {
        const panel    = document.getElementById('notifications-panel');
        const backdrop = document.getElementById('notifications-backdrop');
        if (panel)    panel.classList.add('hidden');
        if (backdrop) backdrop.classList.remove('active');
    },

    showDetail: (id) => {
        App.notifications.close();
        const item = App.notifications._data.find(i => i.id === id);
        if (!item) return;
        document.getElementById('modal-root').innerHTML = Views.app.notificationDetailModal(item);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

/* ── BARCODE SCANNER ────────────────────────────────────────────────── */
// Motor de leitura:
//   1. BarcodeDetector API (nativo Chrome/Edge/Android) — hardware-accelerated, ~60fps
//   2. ZXing BrowserMultiFormatReader (fallback Firefox/Safari)
App.scanner = {
    _stream: null,
    _animFrame: null,
    _detector: null,
    _zxingReader: null,
    _ocrInterval: null,
    _handled: false,

    open: async () => {
        App.scanner._handled = false;
        document.getElementById('modal-root').innerHTML = Views.app.scannerModal();
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (typeof BarcodeDetector !== 'undefined') {
            await App.scanner._startNative();
        } else if (typeof ZXing !== 'undefined' && ZXing.BrowserMultiFormatReader) {
            App.scanner._startZXing();
        } else {
            UI.showToast('Scanner não suportado neste navegador. Use Chrome ou Edge.', 'warning');
            App.scanner.close();
        }
    },

    // ── Caminho 1: BarcodeDetector nativo ──────────────────────────────
    _startNative: async () => {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
            });
        } catch (err) {
            UI.showToast('Não foi possível acessar a câmera. Verifique as permissões.', 'danger');
            App.scanner.close();
            return;
        }
        App.scanner._stream = stream;

        const video = document.getElementById('scanner-video');
        if (!video) { App.scanner.close(); return; }
        video.srcObject = stream;
        await video.play().catch(() => {});

        const wanted = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'itf', 'codabar', 'data_matrix'];
        const supported = await BarcodeDetector.getSupportedFormats().catch(() => []);
        const formats = supported.length ? supported.filter(f => wanted.includes(f)) : wanted;
        App.scanner._detector = new BarcodeDetector({ formats: formats.length ? formats : ['code_128', 'ean_13', 'qr_code'] });

        App.scanner._loopNative(video);
        App.scanner._startOCR(video);
    },

    _loopNative: async (video) => {
        if (App.scanner._handled) return;
        if (video.readyState >= 2) {
            try {
                const results = await App.scanner._detector.detect(video);
                if (results.length > 0) {
                    App.scanner._onSuccess(results[0].rawValue);
                    return;
                }
            } catch (e) {}
        }
        App.scanner._animFrame = requestAnimationFrame(() => App.scanner._loopNative(video));
    },

    // ── Caminho 3: OCR via Tesseract (patrimonial numbers) ────────────────
    _startOCR: (video) => {
        App.scanner._ocrInterval = setInterval(async () => {
            if (App.scanner._handled) return;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            try {
                const result = await Tesseract.recognize(canvas, 'eng', {
                    tessedit_char_whitelist: '0123456789.',
                });
                const text = result.data.text || '';
                const match = text.match(/\b\d{3}\.\d{3}\.\d{3}\.\d{3}\b/);
                if (match) { App.scanner._onSuccess(match[0]); }
            } catch (err) { console.log('OCR erro:', err); }
        }, 1500);
    },

    // ── Caminho 2: ZXing (fallback Firefox/Safari) ─────────────────────
    _startZXing: () => {
        try {
            const reader = new ZXing.BrowserMultiFormatReader();
            App.scanner._zxingReader = reader;
            // decodeFromVideoDevice inicia a câmera e decodifica continuamente
            reader.decodeFromVideoDevice(undefined, 'scanner-video', (result, err) => {
                if (result && !App.scanner._handled) {
                    App.scanner._onSuccess(result.getText());
                }
            }).catch(() => {
                UI.showToast('Não foi possível acessar a câmera. Verifique as permissões.', 'danger');
                App.scanner.close();
            });
        } catch (e) {
            UI.showToast('Erro ao iniciar scanner.', 'danger');
            App.scanner.close();
        }
    },

    close: () => {
        if (App.scanner._animFrame) {
            cancelAnimationFrame(App.scanner._animFrame);
            App.scanner._animFrame = null;
        }
        if (App.scanner._ocrInterval) {
            clearInterval(App.scanner._ocrInterval);
            App.scanner._ocrInterval = null;
        }
        if (App.scanner._zxingReader) {
            try { App.scanner._zxingReader.reset(); } catch (e) {}
            App.scanner._zxingReader = null;
        }
        if (App.scanner._stream) {
            App.scanner._stream.getTracks().forEach(t => t.stop());
            App.scanner._stream = null;
        }
        App.scanner._detector = null;
        const modal = document.getElementById('scanner-modal');
        if (modal) modal.remove();
    },

    _onSuccess: async (decoded) => {
        if (App.scanner._handled) return;
        App.scanner._handled = true;
        App.scanner.close();

        const raw = decoded.trim();
        const digits = raw.replace(/\D/g, '');
        const assetNumber = digits.length === 12
            ? `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}.${digits.slice(9,12)}`
            : raw;

        UI.showToast(`Código lido: ${assetNumber}`, 'success');

        const { data: movements } = await supabaseClient
            .from('asset_movements')
            .select('*, equipment(name), destination_room:destination_room_id(id,name), origin_room:origin_room_id(name), profile:moved_by(full_name)')
            .eq('asset_number', assetNumber)
            .order('moved_at', { ascending: false })
            .limit(1);

        if (movements && movements.length > 0) {
            document.getElementById('modal-root').innerHTML = Views.app.scanResultModal(movements[0], assetNumber);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            await App.modules.movimentacoes.showCreateModal(assetNumber);
            UI.showToast(`PAT "${assetNumber}" não encontrado — preencha a movimentação.`, 'warning');
        }
    }
};

// Filtra a tabela da tela atual conforme o usuário digita na barra de busca do topbar
App.globalSearch = (term) => {
    const route = window.location.hash || '#dashboard';
    const q = term.toLowerCase().trim();

    if (route === '#movimentacoes') {
        const dateFrom = document.getElementById('filter-date-from')?.value;
        const dateTo   = document.getElementById('filter-date-to')?.value;
        const eqId     = document.getElementById('filter-equipment')?.value;
        const origId   = document.getElementById('filter-origin')?.value;
        const destId   = document.getElementById('filter-dest')?.value;
        const respId   = document.getElementById('filter-responsible')?.value;

        const filtered = App.modules.movimentacoes._lastData.filter(m => {
            const d = new Date(m.moved_at);
            if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
            if (dateTo   && d > new Date(dateTo   + 'T23:59:59')) return false;
            if (eqId   && m.equipment_id        !== eqId)   return false;
            if (origId && m.origin_room_id       !== origId) return false;
            if (destId && m.destination_room_id  !== destId) return false;
            if (respId && m.moved_by             !== respId) return false;
            if (q) {
                const hay = [m.equipment?.name, m.serial_number, m.asset_number, m.origin?.name, m.destination?.name, m.profiles?.full_name]
                    .filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        App.modules.movimentacoes._filteredData = filtered;
        App.modules.movimentacoes._page = 1;
        App.modules.movimentacoes.renderPage();

    } else if (route === '#rastreio') {
        const roomId = document.getElementById('rastreio-filter-room')?.value || '';
        const filtered = App.modules.rastreio._data.filter(d => {
            if (roomId && d.destination_room_id !== roomId) return false;
            if (q) {
                const hay = ((d.equipment?.name || '') + ' ' + (d.asset_number || '') + ' ' + (d.serial_number || '')).toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        App.modules.rastreio._filteredData = filtered;
        const tbody = document.getElementById('rastreio-tbody');
        if (tbody) { tbody.innerHTML = Views.app._rastreioRows(filtered); if (typeof lucide !== 'undefined') lucide.createIcons(); }
        const countEl = document.getElementById('rastreio-result-count');
        if (countEl) countEl.textContent = `${filtered.length} equipamento${filtered.length !== 1 ? 's' : ''}`;

    } else if (route === '#equipamentos') {
        document.querySelectorAll('#equipamentos-tbody tr[data-search]').forEach(row => {
            row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none';
        });
    } else if (route === '#salas') {
        document.querySelectorAll('#salas-tbody tr[data-search]').forEach(row => {
            row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none';
        });
    } else if (route === '#usuarios') {
        document.querySelectorAll('#usuarios-tbody tr[data-search]').forEach(row => {
            row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none';
        });
    }
};

App.init();
