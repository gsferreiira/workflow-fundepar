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
        App.renderSidebarProfile();
        App.handleRoute();
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
                const [
                    { count: totalOpen },
                    { count: totalResolved },
                    { count: totalRooms },
                    { count: totalEquipment }
                ] = await Promise.all([
                    supabaseClient.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
                    supabaseClient.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolvido'),
                    supabaseClient.from('rooms').select('*', { count: 'exact', head: true }),
                    supabaseClient.from('equipment').select('*', { count: 'exact', head: true })
                ]);
                document.getElementById('view-content').innerHTML = Views.app.dashboard({ totalOpen, totalResolved, totalRooms, totalEquipment });
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
                    const { error } = await supabaseClient.from('tickets').delete().eq('id', ticketId);
                    if (error) {
                        UI.showToast('Erro ao excluir: ' + error.message, 'danger');
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
            init: async () => {
                const { data: salas, error } = await supabaseClient.from('rooms').select('*').order('name');
                if (error) { UI.showToast(error.message, 'danger'); return; }
                document.getElementById('view-content').innerHTML = Views.app.salas(salas);
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
                document.getElementById('view-content').innerHTML = Views.app.equipamentos(equipamentos);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            showCreateModal: () => {
                document.getElementById('modal-root').innerHTML = Views.app.equipamentoModal();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            create: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                const orig = btn.textContent; btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                const { error } = await supabaseClient.from('equipment').insert([{
                    name:       document.getElementById('equip-name').value,
                    created_by: Auth.user.id
                }]);
                if (error) { UI.showToast('Erro ao cadastrar: ' + error.message, 'danger'); btn.disabled = false; btn.textContent = orig; }
                else { document.getElementById('equipamento-modal').remove(); UI.showToast('Equipamento cadastrado!', 'success'); App.modules.equipamentos.init(); }
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
                    name: document.getElementById('edit-equip-name').value
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

            init: async () => {
                const [
                    { data: locations, error },
                    { data: rooms },
                    { data: profilesList }
                ] = await Promise.all([
                    supabaseClient.from('equipment_locations')
                        .select('*, equipment(name)')
                        .order('moved_at', { ascending: false }),
                    supabaseClient.from('rooms').select('id, name'),
                    supabaseClient.from('profiles').select('id, full_name')
                ]);

                if (error) { UI.showToast(error.message, 'danger'); return; }

                const roomMap    = Object.fromEntries((rooms        || []).map(r => [r.id, r]));
                const profileMap = Object.fromEntries((profilesList || []).map(p => [p.id, p]));

                const data = (locations || []).map(l => ({
                    ...l,
                    room:    roomMap[l.current_room_id] || null,
                    profile: profileMap[l.moved_by]    || null
                }));

                App.modules.rastreio._data = data;
                document.getElementById('view-content').innerHTML = Views.app.rastreio(data);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            filter: (term) => {
                const q = term.toLowerCase().trim();
                document.querySelectorAll('#rastreio-tbody tr[data-search]').forEach(row => {
                    row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none';
                });
            }
        },

        /* ── MOVIMENTAÇÕES ──────────────────────────────────────────── */
        movimentacoes: {
            _equipment: [],
            _rooms: [],
            _lastData: [],

            exportExcel: () => {
                if (typeof XLSX === 'undefined') {
                    UI.showToast('Biblioteca de exportação não carregada.', 'danger');
                    return;
                }
                const rows = App.modules.movimentacoes._lastData;
                if (rows.length === 0) {
                    UI.showToast('Nenhuma movimentação para exportar.', 'warning');
                    return;
                }

                const wsData = [
                    ['Equipamento', 'Nº Série', 'Nº Patrimônio', 'Origem', 'Destino', 'Responsável', 'Data / Hora'],
                    ...rows.map(m => [
                        m.equipment?.name        || '—',
                        m.serial_number          || '—',
                        m.asset_number           || '—',
                        m.origin?.name           || '—',
                        m.destination?.name      || '—',
                        m.profiles?.full_name    || '—',
                        new Date(m.moved_at).toLocaleString('pt-BR')
                    ])
                ];

                const ws = XLSX.utils.aoa_to_sheet(wsData);

                // Largura das colunas
                ws['!cols'] = [
                    { wch: 30 }, { wch: 18 }, { wch: 18 },
                    { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 20 }
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

                App.modules.movimentacoes._lastData = movimentacoes;
                document.getElementById('view-content').innerHTML = Views.app.movimentacoes(movimentacoes);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            showCreateModal: async () => {
                const [{ data: equipment }, { data: rooms }] = await Promise.all([
                    supabaseClient.from('equipment').select('id, name').order('name'),
                    supabaseClient.from('rooms').select('id, name').order('name')
                ]);
                App.modules.movimentacoes._equipment = equipment || [];
                App.modules.movimentacoes._rooms     = rooms     || [];
                document.getElementById('modal-root').innerHTML = Views.app.movimentacaoModal(equipment || [], rooms || []);
                if (typeof lucide !== 'undefined') lucide.createIcons();
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
                if (!editReason) { UI.showToast('A justificativa é obrigatória.', 'warning'); btn.disabled = false; btn.textContent = orig; return; }

                const movedAtVal = document.getElementById('edit-mov-date').value;

                const { error } = await supabaseClient.from('asset_movements').update({
                    serial_number:       document.getElementById('edit-mov-serial').value.trim() || null,
                    asset_number:        document.getElementById('edit-mov-asset').value.trim() || null,
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

                const serialNumber = document.getElementById('mov-serial').value || null;
                const assetNumber  = document.getElementById('mov-asset-number').value || null;
                const receivedBy   = document.getElementById('mov-received-by').value.trim() || null;
                const movedAt      = new Date().toISOString();

                const { error } = await supabaseClient.from('asset_movements').insert([{
                    equipment_id:        equipmentId,
                    serial_number:       serialNumber,
                    asset_number:        assetNumber,
                    origin_room_id:      originRoom.id,
                    destination_room_id: destRoom.id,
                    moved_by:            Auth.user.id,
                    received_by:         receivedBy,
                    moved_at:            movedAt
                }]);

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
            }
        },

        /* ── MAPA DE SALAS ──────────────────────────────────────────── */
        mapaSalas: {
            _rooms: [],

            init: async () => {
                const [
                    { data: rooms, error },
                    { data: locations }
                ] = await Promise.all([
                    supabaseClient.from('rooms').select('*').order('name'),
                    supabaseClient.from('equipment_locations')
                        .select('*, equipment(name)')
                ]);

                if (error) { UI.showToast(error.message, 'danger'); return; }

                const locationsByRoom = {};
                (locations || []).forEach(loc => {
                    const rid = loc.current_room_id;
                    if (!locationsByRoom[rid]) locationsByRoom[rid] = [];
                    locationsByRoom[rid].push({
                        name:          loc.equipment?.name || '—',
                        asset_number:  loc.asset_number    || null,
                        serial_number: loc.serial_number   || null,
                        received_by:   loc.received_by     || null,
                        moved_at:      loc.moved_at        || null
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

App.init();
