// modules/usuarios.js — Gestão de usuários e permissões (admin/tecnico/usuario).
App.modules.usuarios = {
  _list: [],

  init: async () => {
    const { data: usuarios, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .is("deleted_at", null)
      .order("full_name");
    if (error) {
      UI.showToast(error.message, "danger");
      return;
    }
    App.modules.usuarios._list = usuarios || [];
    document.getElementById("view-content").innerHTML = Views.app.usuarios(
      usuarios,
      Auth.user?.id,
      Auth.user?.role,
    );
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  updateRole: async (userId, role) => {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) {
      UI.showToast("Erro ao atualizar permissão.", "danger");
      return;
    }
    const cached = App.modules.usuarios._list.find((u) => u.id === userId);
    if (cached) cached.role = role;
    Audit.updated("profiles", userId, { role });
    UI.showToast("Permissão atualizada!", "success");
  },

  showCreateModal: () => {
    if (Auth.user?.role !== "admin") {
      UI.showToast("Acesso restrito a administradores.", "danger");
      return;
    }
    document.getElementById("modal-root").innerHTML =
      Views.app.usuarioCreateModal();
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  createUsuario: async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Criando...';
    if (typeof lucide !== "undefined") lucide.createIcons();

    const full_name = document.getElementById("create-usuario-name").value.trim();
    const email = document.getElementById("create-usuario-email").value.trim();
    const role = document.getElementById("create-usuario-role").value;

    const user = await Auth.admin.createUser(full_name, email, role);
    if (!user) {
      btn.disabled = false;
      btn.innerHTML = orig;
      if (typeof lucide !== "undefined") lucide.createIcons();
      return;
    }

    Audit.created("profiles", user.id, { full_name, email, role });
    document.getElementById("usuario-create-modal").remove();
    UI.showToast(
      `Usuário "${full_name}" criado. Um e-mail de definição de senha foi enviado.`,
      "success",
    );
    Store.invalidate("profiles");
    App.modules.usuarios.init();
  },

  editUsuario: (userId) => {
    const u = App.modules.usuarios._list.find((u) => u.id === userId);
    if (!u) return;
    document.getElementById("modal-root").innerHTML =
      Views.app.usuarioEditModal(u);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  updateUsuario: async (e, userId) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
    if (typeof lucide !== "undefined") lucide.createIcons();

    const newName = document.getElementById("edit-usuario-name").value.trim();
    const newEmail = document.getElementById("edit-usuario-email").value.trim();

    const { data: existing, error: checkError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("email", newEmail)
      .neq("id", userId)
      .is("deleted_at", null)
      .limit(1);
    if (checkError) {
      UI.showToast("Erro ao validar e-mail: " + checkError.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
      return;
    }
    if (existing && existing.length > 0) {
      UI.showToast("Este e-mail de exibição já está em uso por outro usuário.", "warning");
      btn.disabled = false;
      btn.textContent = orig;
      return;
    }

    const { error } = await supabaseClient
      .from("profiles")
      .update({ full_name: newName, email: newEmail })
      .eq("id", userId);
    if (error) {
      UI.showToast("Erro ao atualizar: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
      return;
    }
    Audit.updated("profiles", userId, { full_name: newName, email: newEmail });
    document.getElementById("usuario-edit-modal").remove();
    UI.showToast("Usuário atualizado!", "success");
    Store.invalidate("profiles");
    App.modules.usuarios.init();
  },

  resetSenha: async (userId, userName, userEmail) => {
    const confirmed = await UI.confirm({
      title: "Enviar e-mail de redefinição",
      message: `Será enviado um e-mail para "${userName}" com um link para redefinir a senha. Deseja continuar?`,
      confirmText: "Enviar e-mail",
    });
    if (!confirmed) return;
    const ok = await Auth.admin.resetPassword(userEmail);
    if (ok) {
      Audit.log("password_reset", "profiles", userId, { email: userEmail });
      UI.showToast(
        `E-mail de redefinição enviado para "${userName}".`,
        "success",
      );
    }
  },

  deleteUsuario: async (userId) => {
    const user = App.modules.usuarios._list.find((u) => u.id === userId);
    const ok = await UI.confirm({
      title: "Excluir usuário",
      message: `Tem certeza que deseja excluir${user ? ` "${user.full_name || user.email}"` : " este usuário"}? Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { data: deleted, error } = await supabaseClient
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId)
      .is("deleted_at", null)
      .select();
    if (error || !deleted || deleted.length === 0) {
      UI.showToast(
        error
          ? "Erro: " + error.message
          : "Sem permissão. Adicione a política RLS no Supabase.",
        "danger",
      );
      return;
    }
    Audit.deleted("profiles", userId, { full_name: user?.full_name, email: user?.email });
    UI.showToast("Usuário removido.", "success");
    Store.invalidate("profiles");
    App.modules.usuarios.init();
  },
};
